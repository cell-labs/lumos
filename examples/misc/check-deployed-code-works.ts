import {CellDep, commons, config, hd, helpers, Indexer, OutPoint, RPC, Script} from "@ckb-lumos/lumos";
import {bytes, hexify} from "@ckb-lumos/lumos/codec";
import {Bytes} from "@ckb-lumos/lumos/codec/blockchain";

const CONFIG = config.predefined.AGGRON4;
const PRIVATE_KEY = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const fromLock = {
  codeHash: CONFIG.SCRIPTS.SECP256K1_BLAKE160.CODE_HASH,
  hashType: CONFIG.SCRIPTS.SECP256K1_BLAKE160.HASH_TYPE,
  args: hd.key.privateKeyToBlake160(PRIVATE_KEY),
};
const fromAddress = helpers.encodeToAddress(fromLock, { config: CONFIG });

async function main() {

  const referencedTypeScript : Script= {
    codeHash: "0x44cb3bef0e4f8b498f95d89189c22cd442d0bfc3c665ff6ba0c5dd1f69777687",
    hashType: "type",
    args: "0x"
  };
  const referencedCellDep: CellDep = {
    depType: "code",
    outPoint: {
      txHash: '0xb48059392fb857a213208187ddab35cd94203dba66aae88dcd06f2744bf751c2',
      index: "0x0",
    },
  };

  // NOTE: It's a trick to preoccupy some capacity, which will be used to store our referencedTypeScript.
  const alwaysSuccess = bytes.bytify('0x44cb3bef0e4f8b498f95d89189c22cd442d0bfc3c665ff6ba0c5dd1f69777687' + '01');

  const indexer = new Indexer("https://testnet.ckb.dev");
  const rpc = new RPC("https://testnet.ckb.dev");

  let { txSkeleton, scriptConfig, typeId } = await commons.deploy.generateDeployWithTypeIdTx({
    scriptBinary: alwaysSuccess,
    config: CONFIG,
    feeRate: 1000n,
    cellProvider: indexer,
    fromInfo: fromAddress,
  });

  // Attach self-deployed script to the output's type field
  txSkeleton = txSkeleton.update("cellDeps", (cellDeps) => {
    cellDeps = cellDeps.push(referencedCellDep);
    return cellDeps;
  });
  txSkeleton = txSkeleton.update("outputs", (outputs) => {
    const output = outputs.get(0)!;

    // Reference to the deployed code to make sure our deployed code can work.
    output.cellOutput.type = referencedTypeScript;

    // NOTE: Clean the unused data field, `scriptBinary`, which is used for preoccupying capacity.
    output.data = "0x";

    outputs.set(0, output);
    return outputs;
  });


  txSkeleton = commons.common.prepareSigningEntries(txSkeleton, { config: CONFIG });

  const signature = hd.key.signRecoverable(txSkeleton.get("signingEntries").get(0)!.message!, PRIVATE_KEY);
  const signedTx = helpers.sealTransaction(txSkeleton, [signature]);

  const txHash = await rpc.sendTransaction(signedTx);
  console.log(`txHash: ${txHash}`);
}

main();
