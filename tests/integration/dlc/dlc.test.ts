import 'mocha';
import chai from 'chai';
import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import BN from 'bignumber.js';
import _ from 'lodash';
import { decodeRawTransaction } from '@liquality/bitcoin-utils';
import Client from '@liquality/client';
import { chains, fundAddress, mineBlock, getInput } from '../common';
import { Messages } from '../@types/cfd-dlc-js';
import Amount from '../../../packages/bitcoin-dlc-provider/lib/models/Amount';
import {
  bitcoin,
  wallet,
  Address,
} from '../../../packages/bitcoin-dlc-provider/lib/@types/@liquality/types';
import Input from '../../../packages/bitcoin-dlc-provider/lib/models/Input';
import Oracle from '../models/Oracle';
import { math } from 'bip-schnorr';
import { sleep } from '@liquality/utils';
import {
  ContractInfoV0,
  ContractDescriptorV0,
  OracleInfoV0,
  OracleAnnouncementV0,
  OracleEventV0,
  OracleAttestationV0,
  EnumEventDescriptorV0,
  DigitDecompositionEventDescriptorV0,
  ContractInfoV1,
  ContractDescriptorV1,
  RoundingIntervalsV0,
  FundingInputV0,
  DlcTransactionsV0,
} from '@node-dlc/messaging';
import { CoveredCall, groupByIgnoringDigits } from '@node-dlc/core';
import { sha256 } from '@liquality/crypto';
import * as fs from 'fs';
import * as base64 from 'base64-js';
import { Psbt } from 'bitcoinjs-lib';

import * as base2Output from '../outputs/base2.json';

const chain = chains.bitcoinWithJs;
const alice = chain.client;
const network = chain.network;

const bob = chains.bitcoinWithJs2.client;

describe('dlc provider', () => {
  it('should create a covered call contract', async () => {
    const numDigits = 17;
    const oracleBase = 2;

    const aliceNonChangeAddresses: string[] = (
      await alice.wallet.getAddresses(0, 10, false)
    ).map((address) => address.address);
    const aliceChangeAddresses: string[] = (
      await alice.wallet.getAddresses(0, 10, true)
    ).map((address) => address.address);

    const aliceAddresses = [
      ...aliceNonChangeAddresses,
      ...aliceChangeAddresses,
    ];

    for (let i = 0; i < aliceAddresses.length; i++) {
      await alice.getMethod('jsonrpc')(
        'importaddress',
        aliceAddresses[i],
        '',
        false,
      );
    }

    console.time('offer-get-time');
    const aliceInput = await getInput(alice);
    const bobInput = await getInput(bob);

    const oracle = new Oracle('olivia', numDigits);
    const oliviaInfo = oracle.GetOracleInfo();

    const eventDescriptor = new DigitDecompositionEventDescriptorV0();
    eventDescriptor.base = oracleBase;
    eventDescriptor.isSigned = false;
    eventDescriptor.unit = 'BTC-USD';
    eventDescriptor.precision = 0;
    eventDescriptor.nbDigits = numDigits;

    const event = new OracleEventV0();
    event.oracleNonces = oliviaInfo.rValues.map((rValue) =>
      Buffer.from(rValue, 'hex'),
    );
    event.eventMaturityEpoch = 1617170572;
    event.eventDescriptor = eventDescriptor;
    event.eventId = 'btc/usd';

    // const announcement = OracleAnnouncementV0.deserialize(
    //   Buffer.from(
    //     'fdd824fd02d59a121c157514df82ea0c57d0d82c78105f6272fc4ebd26d0c8f2903f406759e38e77578edee940590b11b875bacdac30ce1f4b913089a7e4e95884edf6f3eb195d1bcfab252c6dd9edd7aea4c5eeeef138f7ff7346061ea40143a9f5ae80baa9fdd822fd026f0012d39fca86c2492977c0a2909583b2c154bb121834658d75502d41a0e3b719fb0cd80ea2438d18d049be2d3aa4f1a3096628614d7bdda32757fd9a206c8e8c25c514b68799e03bb713d542f6c35ffaa0917fe18646969c77d56f4d8aa0f0fb30b26d746cb0713e27a56f8aa56dc828120b523fee21b2f0bc9d3a4a6d9855c251fd6405bb7f6c1dfee97d24cfd7ad533c06162a22f4fc9fdd0e5c02e94201c239bb13753ab5c56881f55367321ebd44e302241b42c99aa67dffb2d229178701d71a756244c433d15f9b20d33628540da5c07face604980e5f709aa0bbfdb157b7a8abc8d946f9e5d67c1e91bf22d77f5c097e6b3a51a420a8d882a3cad98cb4f84ace075a8acee1ef4f229e1b2b403ffb9f43a825ca8410b7d803b91ae54959ecd630e824310749ed1ee54e0e40e0af49d9a11bfbdbf36146234063c00520ed4416a2dafe74f9c0542b2d58c58fa75e9bb5a95c291d934f4dd513c405e9ddc58543ab4a586bf0b9abf7a12aa272ff29429df38164e3e5d418b913c818c1858a3a8b19355a1ceaee7318a245bab2b09d94bf39f7b600665c3b8b8a655cf54f85c1b38ed41798968a0da05884d9f0e201b3e3be3a3740cf31439fd325248eed65fa9344390f5748bbbbbcab4b2f200b9fdd860a1fc813431e0aff174476f4d4d254c6ecbb4f8f31ba16858a95a4d138e206c8d96126a69b2b7ebb6b2ec9c3a37a9a128162aed19361e41b0fe4ff1504df2a0bd150d7c96860d08990f12eb65bf5e5dab79e0fe16db4e7a26d9817d7e50a2c37a8c44a330de349d2ce9e33b802aa0f97605d2400fdd80a11000200074254432d55534400000000001213446572696269742d4254432d32364d41523231',
    //     'hex',
    //   ),
    // );

    const announcement = new OracleAnnouncementV0();
    announcement.announcementSig = Buffer.from(
      oracle.GetSignature(sha256(event.serialize())),
      'hex',
    );
    announcement.oraclePubkey = Buffer.from(oliviaInfo.publicKey, 'hex');
    announcement.oracleEvent = event;

    const oracleInfo = new OracleInfoV0();
    oracleInfo.announcement = announcement;

    const { payoutFunction, totalCollateral } = CoveredCall.buildPayoutFunction(
      4000n,
      1000000n,
      oracleBase,
      numDigits,
    );

    const intervals = [{ beginInterval: 0n, roundingMod: 500n }];
    const roundingIntervals = new RoundingIntervalsV0();
    roundingIntervals.intervals = intervals;

    const contractDescriptor = new ContractDescriptorV1();
    contractDescriptor.numDigits = numDigits;
    contractDescriptor.payoutFunction = payoutFunction;
    contractDescriptor.roundingIntervals = roundingIntervals;

    const contractInfo = new ContractInfoV0();
    contractInfo.totalCollateral = totalCollateral;
    contractInfo.contractDescriptor = contractDescriptor;
    contractInfo.oracleInfo = oracleInfo;

    const feeRatePerVb = BigInt(10);
    const cetLocktime = 1617170572;
    const refundLocktime = 1617170572;

    const dlcOffer = await alice.finance.dlc.createDlcOffer(
      contractInfo,
      totalCollateral - BigInt(2000),
      feeRatePerVb,
      cetLocktime,
      refundLocktime,
      [aliceInput],
    );

    console.timeEnd('offer-get-time');

    console.time('accept-time');
    const {
      dlcAccept,
      dlcTransactions,
    } = await bob.finance.dlc.acceptDlcOffer(dlcOffer, [bobInput]);
    console.time('accept-time-serialize');

    fs.writeFile(
      'file-output/accept-hex.txt',
      dlcAccept.serialize().toString('hex'),
      function (err) {
        if (err) return console.log(err);
        console.log('DlcAccept > accept-hex.txt');
      },
    );

    fs.writeFile(
      'file-output/accept-base64.txt',
      base64.fromByteArray(dlcAccept.serialize()),
      function (err) {
        if (err) return console.log(err);
        console.log('DlcAccept > accept-base64.txt');
      },
    );

    console.timeEnd('accept-time-serialize');
    console.timeEnd('accept-time');

    console.time('sign-time');
    const {
      dlcSign,
      dlcTransactions: dlcTxs,
    } = await alice.finance.dlc.signDlcAccept(dlcOffer, dlcAccept);
    console.timeEnd('sign-time');

    const fundTx = await bob.finance.dlc.finalizeDlcSign(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTransactions,
    );
    const fundTxId = await bob.chain.sendRawTransaction(
      fundTx.serialize().toString('hex'),
    );
    console.log('fundTxId', fundTxId);

    // get oracle to create attestation
    const outcome = 3000;

    const { base, nbDigits } = eventDescriptor;

    const outcomes = outcome.toString(base).padStart(nbDigits, '0').split('');

    const sigs: Buffer[] = [];
    for (let i = 0; i < nbDigits; i++) {
      const m = math
        .taggedHash('DLC/oracle/attestation/v0', outcomes[i].toString())
        .toString('hex');
      sigs.push(Buffer.from(oracle.GetSignature(m, i + 1), 'hex'));
    }

    const oracleAttestation = new OracleAttestationV0();
    oracleAttestation.eventId = 'btc/usd';
    oracleAttestation.oraclePubkey = Buffer.from(oliviaInfo.publicKey, 'hex');
    oracleAttestation.signatures = sigs;
    oracleAttestation.outcomes = outcomes;

    // const oracleAttestation = OracleAttestationV0.deserialize(
    //   Buffer.from(
    //     'fdd868fd04da13446572696269742d4254432d32364d415232315d1bcfab252c6dd9edd7aea4c5eeeef138f7ff7346061ea40143a9f5ae80baa90012d39fca86c2492977c0a2909583b2c154bb121834658d75502d41a0e3b719fb0c958d8f9b10b0160e90eec5d4cd6779829105066a458e90c532b33e44e8bd8907d80ea2438d18d049be2d3aa4f1a3096628614d7bdda32757fd9a206c8e8c25c56c80e049f294876f040cb29f695c9eaec210a5dc69adacb65884f0fd281a303414b68799e03bb713d542f6c35ffaa0917fe18646969c77d56f4d8aa0f0fb30b21d34366e2fff8c931474b4d579ebfedd4c182f46da2ecde4e585014487da74156d746cb0713e27a56f8aa56dc828120b523fee21b2f0bc9d3a4a6d9855c251fdc5464ea7de26d48961c8fe1f8c30d5115d223ef1daf0b01ecfe3e5fb621531f26405bb7f6c1dfee97d24cfd7ad533c06162a22f4fc9fdd0e5c02e94201c239bba28e6472b78ace34b61540009a05ddf4d41ed69139d9ebc479794687fd0854cb13753ab5c56881f55367321ebd44e302241b42c99aa67dffb2d229178701d71a73bb12583356d4127760b9f77061442a02e87add0e9644a674118740890e9385756244c433d15f9b20d33628540da5c07face604980e5f709aa0bbfdb157b7a8846c3d6ef8c9c04dd1a0cffc31e0a2dce8993ba6747537266dcfc7bed771c9c4abc8d946f9e5d67c1e91bf22d77f5c097e6b3a51a420a8d882a3cad98cb4f84a88a6404efb146697e49a95f552ed9c3cc82bed630dcbff3624c7e4045e4e9086ce075a8acee1ef4f229e1b2b403ffb9f43a825ca8410b7d803b91ae54959ecd63b88f5c0e434874bca2bbf450a73f04a8cfe67e656c88f388328ceba913e418330e824310749ed1ee54e0e40e0af49d9a11bfbdbf36146234063c00520ed44165a0e71db7715455a21c090f1eca1bdd23c54714b564d5061c8bd31ca7aeb40fba2dafe74f9c0542b2d58c58fa75e9bb5a95c291d934f4dd513c405e9ddc58543cf74dbb37cfb25177458bed70ae641b6dba87f9f05fff8c15f74ef60703a5d31ab4a586bf0b9abf7a12aa272ff29429df38164e3e5d418b913c818c1858a3a8bf3c38e43059dfc8e96d4e21c7685b6b6084609795957d5bdec3bb871e89ab72719355a1ceaee7318a245bab2b09d94bf39f7b600665c3b8b8a655cf54f85c1b355d0fe2e29ec5336525dbbd673f5f4b9ceb9f9f906f29cb42f12da3af17f5b218ed41798968a0da05884d9f0e201b3e3be3a3740cf31439fd325248eed65fa93ce6c66cbf91c4e07fbb82328f60ce024d7884b29839264f6c50aba8d9f89253a44390f5748bbbbbcab4b2f200b9fdd860a1fc813431e0aff174476f4d4d254c6013e77461c006bfb1cf1a63149e91e1b37ff16ae6a8a4e02f4bc98b84d7f5de4ecbb4f8f31ba16858a95a4d138e206c8d96126a69b2b7ebb6b2ec9c3a37a9a12dbc396935195cc553e4f33b2434a5e052f5ee59f99454e2f0b8e1ccb8ddbee0b8162aed19361e41b0fe4ff1504df2a0bd150d7c96860d08990f12eb65bf5e5da02e4b8223853d407ba8ad25cca32992f1d794fff08dc93941e7a25c2a4fe1e4ab79e0fe16db4e7a26d9817d7e50a2c37a8c44a330de349d2ce9e33b802aa0f97a3d8f41cf26c9b4a5de9b98146f38fa8ddcc27a4ab76b8c6e7dcc786af130664013001300131013101300130013101310131013101310131013001310130013101300130',
    //     'hex',
    //   ),
    // );

    // generate payouts (used for accept)
    const payouts = CoveredCall.computePayouts(
      payoutFunction,
      totalCollateral,
      roundingIntervals,
    );

    const groups = [];
    payouts.forEach((p) => {
      groups.push({
        payout: p.payout,
        groups: groupByIgnoringDigits(
          p.indexFrom,
          p.indexTo,
          oracleBase,
          numDigits,
        ),
      });
    });

    console.log('groups', groups);
    console.log(
      `# of CETS: ${groups.reduce(
        (acc, group) => acc + group.groups.length,
        0,
      )}`,
    );

    const cet = await bob.finance.dlc.execute(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTxs,
      oracleAttestation,
      false,
    );
    console.log('cet', cet.serialize().toString('hex'));
    const cetTx = await bob.chain.sendRawTransaction(
      cet.serialize().toString('hex'),
    );
    console.log('cetTx', cetTx);

    // const testRefund = await bob.finance.dlc.refund(
    //   dlcOffer,
    //   dlcAccept,
    //   dlcSign,
    //   dlcTxs,
    // );
    // console.log('testRefund', testRefund.refundTx.serialize().toString('hex'));

    // alice.getMethod('getBalance')()

    // const balance = await alice.chain.getBalance(aliceAddresses);
    // console.log('balance ', balance);

    // const psbt: Psbt = await alice.finance.dlc.close(
    //   dlcOffer,
    //   dlcAccept,
    //   dlcSign,
    //   dlcTxs,
    //   10000n,
    //   true,
    // );

    // console.log('psbt', psbt.toBase64());

    // const psbt2: Psbt = await bob.finance.dlc.close(
    //   dlcOffer,
    //   dlcAccept,
    //   dlcSign,
    //   dlcTxs,
    //   10000n,
    //   false,
    //   psbt,
    // );

    // console.log(
    //   'psbt2.extractTransaction().toHex()',
    //   psbt2.extractTransaction().toHex(),
    // );
  });

  /**
   * External Test Vectors
   * i.e. Suredbits Oracle: https://test.oracle.suredbits.com/event/dae0e209c8a6747c27b9adf3d2fd3e1245b28fcef82e9e13e9a1b708f013a719
   * oracle_announcement_v0
   */
  describe('external test vectors', () => {
    it('executes', async () => {
      const numDigits = 18;
      const oracleBase = 2;

      console.time('offer-get-time');
      const aliceInput = await getInput(alice);
      const bobInput = await getInput(bob);

      const oracle = new Oracle('olivia', numDigits);
      const oliviaInfo = oracle.GetOracleInfo();

      const eventDescriptor = new DigitDecompositionEventDescriptorV0();
      eventDescriptor.base = oracleBase;
      eventDescriptor.isSigned = false;
      eventDescriptor.unit = 'BTC-USD';
      eventDescriptor.precision = 0;
      eventDescriptor.nbDigits = numDigits;

      const event = new OracleEventV0();
      event.oracleNonces = oliviaInfo.rValues.map((rValue) =>
        Buffer.from(rValue, 'hex'),
      );
      event.eventMaturityEpoch = 1617170572;
      event.eventDescriptor = eventDescriptor;
      event.eventId = 'btc/usd';

      const announcement = OracleAnnouncementV0.deserialize(
        Buffer.from(
          'fdd824fd02d59a121c157514df82ea0c57d0d82c78105f6272fc4ebd26d0c8f2903f406759e38e77578edee940590b11b875bacdac30ce1f4b913089a7e4e95884edf6f3eb195d1bcfab252c6dd9edd7aea4c5eeeef138f7ff7346061ea40143a9f5ae80baa9fdd822fd026f0012d39fca86c2492977c0a2909583b2c154bb121834658d75502d41a0e3b719fb0cd80ea2438d18d049be2d3aa4f1a3096628614d7bdda32757fd9a206c8e8c25c514b68799e03bb713d542f6c35ffaa0917fe18646969c77d56f4d8aa0f0fb30b26d746cb0713e27a56f8aa56dc828120b523fee21b2f0bc9d3a4a6d9855c251fd6405bb7f6c1dfee97d24cfd7ad533c06162a22f4fc9fdd0e5c02e94201c239bb13753ab5c56881f55367321ebd44e302241b42c99aa67dffb2d229178701d71a756244c433d15f9b20d33628540da5c07face604980e5f709aa0bbfdb157b7a8abc8d946f9e5d67c1e91bf22d77f5c097e6b3a51a420a8d882a3cad98cb4f84ace075a8acee1ef4f229e1b2b403ffb9f43a825ca8410b7d803b91ae54959ecd630e824310749ed1ee54e0e40e0af49d9a11bfbdbf36146234063c00520ed4416a2dafe74f9c0542b2d58c58fa75e9bb5a95c291d934f4dd513c405e9ddc58543ab4a586bf0b9abf7a12aa272ff29429df38164e3e5d418b913c818c1858a3a8b19355a1ceaee7318a245bab2b09d94bf39f7b600665c3b8b8a655cf54f85c1b38ed41798968a0da05884d9f0e201b3e3be3a3740cf31439fd325248eed65fa9344390f5748bbbbbcab4b2f200b9fdd860a1fc813431e0aff174476f4d4d254c6ecbb4f8f31ba16858a95a4d138e206c8d96126a69b2b7ebb6b2ec9c3a37a9a128162aed19361e41b0fe4ff1504df2a0bd150d7c96860d08990f12eb65bf5e5dab79e0fe16db4e7a26d9817d7e50a2c37a8c44a330de349d2ce9e33b802aa0f97605d2400fdd80a11000200074254432d55534400000000001213446572696269742d4254432d32364d41523231',
          'hex',
        ),
      );

      const oracleInfo = new OracleInfoV0();
      oracleInfo.announcement = announcement;

      const {
        payoutFunction,
        totalCollateral,
      } = CoveredCall.buildPayoutFunction(
        4000n,
        1000000n,
        oracleBase,
        numDigits,
      );

      const intervals = [{ beginInterval: 0n, roundingMod: 500n }];
      const roundingIntervals = new RoundingIntervalsV0();
      roundingIntervals.intervals = intervals;

      const contractDescriptor = new ContractDescriptorV1();
      contractDescriptor.numDigits = numDigits;
      contractDescriptor.payoutFunction = payoutFunction;
      contractDescriptor.roundingIntervals = roundingIntervals;

      const contractInfo = new ContractInfoV0();
      contractInfo.totalCollateral = totalCollateral;
      contractInfo.contractDescriptor = contractDescriptor;
      contractInfo.oracleInfo = oracleInfo;

      const feeRatePerVb = BigInt(10);
      const cetLocktime = 1617170572;
      const refundLocktime = 1617170572;

      const dlcOffer = await alice.finance.dlc.createDlcOffer(
        contractInfo,
        totalCollateral - BigInt(2000),
        feeRatePerVb,
        cetLocktime,
        refundLocktime,
        [aliceInput],
      );

      console.timeEnd('offer-get-time');

      console.time('accept-time');
      const {
        dlcAccept,
        dlcTransactions,
      } = await bob.finance.dlc.acceptDlcOffer(dlcOffer, [bobInput]);
      console.time('accept-time-serialize');

      fs.writeFile(
        'file-output/accept-hex.txt',
        dlcAccept.serialize().toString('hex'),
        function (err) {
          if (err) return console.log(err);
          console.log('DlcAccept > accept-hex.txt');
        },
      );

      fs.writeFile(
        'file-output/accept-base64.txt',
        base64.fromByteArray(dlcAccept.serialize()),
        function (err) {
          if (err) return console.log(err);
          console.log('DlcAccept > accept-base64.txt');
        },
      );

      console.timeEnd('accept-time-serialize');
      console.timeEnd('accept-time');

      console.time('sign-time');
      const {
        dlcSign,
        dlcTransactions: dlcTxs,
      } = await alice.finance.dlc.signDlcAccept(dlcOffer, dlcAccept);
      console.timeEnd('sign-time');

      const fundTx = await bob.finance.dlc.finalizeDlcSign(
        dlcOffer,
        dlcAccept,
        dlcSign,
        dlcTransactions,
      );
      const fundTxId = await bob.chain.sendRawTransaction(
        fundTx.serialize().toString('hex'),
      );
      console.log('fundTxId', fundTxId);

      const oracleAttestation = OracleAttestationV0.deserialize(
        Buffer.from(
          'fdd868fd04da13446572696269742d4254432d32364d415232315d1bcfab252c6dd9edd7aea4c5eeeef138f7ff7346061ea40143a9f5ae80baa90012d39fca86c2492977c0a2909583b2c154bb121834658d75502d41a0e3b719fb0c958d8f9b10b0160e90eec5d4cd6779829105066a458e90c532b33e44e8bd8907d80ea2438d18d049be2d3aa4f1a3096628614d7bdda32757fd9a206c8e8c25c56c80e049f294876f040cb29f695c9eaec210a5dc69adacb65884f0fd281a303414b68799e03bb713d542f6c35ffaa0917fe18646969c77d56f4d8aa0f0fb30b21d34366e2fff8c931474b4d579ebfedd4c182f46da2ecde4e585014487da74156d746cb0713e27a56f8aa56dc828120b523fee21b2f0bc9d3a4a6d9855c251fdc5464ea7de26d48961c8fe1f8c30d5115d223ef1daf0b01ecfe3e5fb621531f26405bb7f6c1dfee97d24cfd7ad533c06162a22f4fc9fdd0e5c02e94201c239bba28e6472b78ace34b61540009a05ddf4d41ed69139d9ebc479794687fd0854cb13753ab5c56881f55367321ebd44e302241b42c99aa67dffb2d229178701d71a73bb12583356d4127760b9f77061442a02e87add0e9644a674118740890e9385756244c433d15f9b20d33628540da5c07face604980e5f709aa0bbfdb157b7a8846c3d6ef8c9c04dd1a0cffc31e0a2dce8993ba6747537266dcfc7bed771c9c4abc8d946f9e5d67c1e91bf22d77f5c097e6b3a51a420a8d882a3cad98cb4f84a88a6404efb146697e49a95f552ed9c3cc82bed630dcbff3624c7e4045e4e9086ce075a8acee1ef4f229e1b2b403ffb9f43a825ca8410b7d803b91ae54959ecd63b88f5c0e434874bca2bbf450a73f04a8cfe67e656c88f388328ceba913e418330e824310749ed1ee54e0e40e0af49d9a11bfbdbf36146234063c00520ed44165a0e71db7715455a21c090f1eca1bdd23c54714b564d5061c8bd31ca7aeb40fba2dafe74f9c0542b2d58c58fa75e9bb5a95c291d934f4dd513c405e9ddc58543cf74dbb37cfb25177458bed70ae641b6dba87f9f05fff8c15f74ef60703a5d31ab4a586bf0b9abf7a12aa272ff29429df38164e3e5d418b913c818c1858a3a8bf3c38e43059dfc8e96d4e21c7685b6b6084609795957d5bdec3bb871e89ab72719355a1ceaee7318a245bab2b09d94bf39f7b600665c3b8b8a655cf54f85c1b355d0fe2e29ec5336525dbbd673f5f4b9ceb9f9f906f29cb42f12da3af17f5b218ed41798968a0da05884d9f0e201b3e3be3a3740cf31439fd325248eed65fa93ce6c66cbf91c4e07fbb82328f60ce024d7884b29839264f6c50aba8d9f89253a44390f5748bbbbbcab4b2f200b9fdd860a1fc813431e0aff174476f4d4d254c6013e77461c006bfb1cf1a63149e91e1b37ff16ae6a8a4e02f4bc98b84d7f5de4ecbb4f8f31ba16858a95a4d138e206c8d96126a69b2b7ebb6b2ec9c3a37a9a12dbc396935195cc553e4f33b2434a5e052f5ee59f99454e2f0b8e1ccb8ddbee0b8162aed19361e41b0fe4ff1504df2a0bd150d7c96860d08990f12eb65bf5e5da02e4b8223853d407ba8ad25cca32992f1d794fff08dc93941e7a25c2a4fe1e4ab79e0fe16db4e7a26d9817d7e50a2c37a8c44a330de349d2ce9e33b802aa0f97a3d8f41cf26c9b4a5de9b98146f38fa8ddcc27a4ab76b8c6e7dcc786af130664013001300131013101300130013101310131013101310131013001310130013101300130',
          'hex',
        ),
      );

      // generate payouts (used for accept)
      const payouts = CoveredCall.computePayouts(
        payoutFunction,
        totalCollateral,
        roundingIntervals,
      );

      const groups = [];
      payouts.forEach((p) => {
        groups.push({
          payout: p.payout,
          groups: groupByIgnoringDigits(
            p.indexFrom,
            p.indexTo,
            oracleBase,
            numDigits,
          ),
        });
      });

      console.log('groups', groups);
      console.log(
        `# of CETS: ${groups.reduce(
          (acc, group) => acc + group.groups.length,
          0,
        )}`,
      );

      const cet = await bob.finance.dlc.execute(
        dlcOffer,
        dlcAccept,
        dlcSign,
        dlcTxs,
        oracleAttestation,
        false,
      );
      console.log('cet', cet.serialize().toString('hex'));
      const cetTx = await bob.chain.sendRawTransaction(
        cet.serialize().toString('hex'),
      );
      console.log('cetTx', cetTx);
    });
  });
});

const BurnAddress = 'bcrt1qxcjufgh2jarkp2qkx68azh08w9v5gah8u6es8s';
