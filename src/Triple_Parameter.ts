import {
  Field,
  PrivateKey,
  PublicKey,
  SmartContract,
  state,
  State,
  method,
  UInt64,
  Mina,
  Party,
  Group,
  shutdown,
  isReady,
} from 'snarkyjs';

class Triple extends SmartContract {
  @state(Field) a: State<Field>;
  @state(Field) b: State<Field>;
  @state(Field) c: State<Field>;
  
  constructor(initialBalance: UInt64, address: PublicKey, a_in: Field, b_in: Field, c_in: Field) {
    super(address);
    this.balance.addInPlace(initialBalance);
    this.a = State.init(a_in);
    this.b = State.init(b_in);
    this.c = State.init(c_in);
  }

	// update a, b, c with 
	// x, x*y and x-y
	@method async update_all(input_x: Field, input_y: Field) {
    this.a.set(input_x);
	this.b.set(input_x.mul(input_y));
	this.c.set(input_x.sub(input_y));
  }
}

async function runSimpleApp() {
  await isReady;

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const account1 = Local.testAccounts[0].privateKey;
  const account2 = Local.testAccounts[1].privateKey;

  const snappPrivkey = PrivateKey.random();
  const snappPubkey = snappPrivkey.toPublicKey();

  let snappInstance: Triple;
  const initSnappState_a = new Field(3);
  const initSnappState_b = new Field(3);
  const initSnappState_c = new Field(3);

  // Deploys the snapp
  await Mina.transaction(account1, async () => {
    // account2 sends 1000000000 to the new snapp account
    const amount = UInt64.fromNumber(1000000000);
    const p = await Party.createSigned(account2);
    p.balance.subInPlace(amount);

    snappInstance = new Triple(amount, snappPubkey, initSnappState_a, initSnappState_b, initSnappState_c);
  })
    .send()
    .wait();

  // Update the snapp
  await Mina.transaction(account1, async () => {
    await snappInstance.update_all(new Field(9), new Field(7));
  })
    .send()
    .wait();

  const a = await Mina.getAccount(snappPubkey);

  console.log('final state value a:', a.snapp.appState[0].toString());
  console.log('final state value b:', a.snapp.appState[1].toString());
  console.log('final state value c:', a.snapp.appState[2].toString());

	a.snapp.appState[0].assertEquals(9); // 9
	a.snapp.appState[1].assertEquals(63); // 9*7
	a.snapp.appState[2].assertEquals(2); // 9-7
}

runSimpleApp();

shutdown();
