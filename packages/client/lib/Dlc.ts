import {
  AddSignaturesToRefundTxRequest,
  AddSignaturesToRefundTxResponse,
  AddSignatureToFundTransactionRequest,
  AddSignatureToFundTransactionResponse,
  CreateCetAdaptorSignatureRequest,
  CreateCetAdaptorSignatureResponse,
  CreateCetAdaptorSignaturesRequest,
  CreateCetAdaptorSignaturesResponse,
  CreateCetRequest,
  CreateCetResponse,
  CreateDlcTransactionsRequest,
  CreateDlcTransactionsResponse,
  CreateFundTransactionRequest,
  CreateFundTransactionResponse,
  CreateRefundTransactionRequest,
  CreateRefundTransactionResponse,
  GetRawFundTxSignatureRequest,
  GetRawFundTxSignatureResponse,
  GetRawRefundTxSignatureRequest,
  GetRawRefundTxSignatureResponse,
  SignCetRequest,
  SignCetResponse,
  SignFundTransactionRequest,
  SignFundTransactionResponse,
  VerifyCetAdaptorSignatureRequest,
  VerifyCetAdaptorSignatureResponse,
  VerifyCetAdaptorSignaturesRequest,
  VerifyCetAdaptorSignaturesResponse,
  VerifyFundTxSignatureRequest,
  VerifyFundTxSignatureResponse,
  VerifyRefundTxSignatureRequest,
  VerifyRefundTxSignatureResponse,
} from '@atomicfinance/types';
import {
  ContractInfo,
  DlcAccept,
  DlcOffer,
  DlcSign,
  DlcTransactions,
  FundingInput,
  OracleAttestationV0,
} from '@node-dlc/messaging';
import { Tx } from '@node-lightning/bitcoin';
import { Psbt } from 'bitcoinjs-lib';

export default class Dlc {
  client: any;

  constructor(client: any) {
    this.client = client;
  }

  /**
   * Check whether wallet is offerer of DlcOffer or DlcAccept
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @returns {Promise<boolean>}
   */
  async isOfferer(dlcOffer: DlcOffer, dlcAccept: DlcAccept): Promise<boolean> {
    return this.client.getMethod('isOfferer')(dlcOffer, dlcAccept);
  }

  /**
   * Create DLC Offer Message
   * @param contractInfo ContractInfo TLV (V0 or V1)
   * @param offerCollateralSatoshis Amount DLC Initiator is putting into the contract
   * @param feeRatePerVb Fee rate in satoshi per virtual byte that both sides use to compute fees in funding tx
   * @param cetLocktime The nLockTime to be put on CETs
   * @param refundLocktime The nLockTime to be put on the refund transaction
   * @returns {Promise<DlcOffer>}
   */
  async createDlcOffer(
    contractInfo: ContractInfo,
    offerCollateralSatoshis: bigint,
    feeRatePerVb: bigint,
    cetLocktime: number,
    refundLocktime: number,
    fixedInputs?: IInput[],
  ): Promise<DlcOffer> {
    return this.client.getMethod('createDlcOffer')(
      contractInfo,
      offerCollateralSatoshis,
      feeRatePerVb,
      cetLocktime,
      refundLocktime,
      fixedInputs,
    );
  }

  /**
   * Accept DLC Offer
   * @param dlcOffer Dlc Offer Message
   * @param fixedInputs Optional inputs to use for Funding Inputs
   * @returns {Promise<AcceptDlcOfferResponse}
   */
  async acceptDlcOffer(
    dlcOffer: DlcOffer,
    fixedInputs?: IInput[],
  ): Promise<AcceptDlcOfferResponse> {
    return this.client.getMethod('acceptDlcOffer')(dlcOffer, fixedInputs);
  }

  /**
   * Sign Dlc Accept Message
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @returns {Promise<SignDlcAcceptResponse}
   */
  async signDlcAccept(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
  ): Promise<SignDlcAcceptResponse> {
    return this.client.getMethod('signDlcAccept')(dlcOffer, dlcAccept);
  }

  /**
   * Finalize Dlc Sign
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @param dlcSign Dlc Sign Message
   * @param dlcTxs Dlc Transactions Message
   * @returns {Promise<Tx>}
   */
  async finalizeDlcSign(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
  ): Promise<Tx> {
    return this.client.getMethod('finalizeDlcSign')(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTxs,
    );
  }

  /**
   * Execute DLC
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @param dlcSign Dlc Sign Message
   * @param dlcTxs Dlc Transactions Message
   * @param oracleAttestation Oracle Attestations TLV (V0)
   * @param isOfferer Whether party is Dlc Offerer
   * @returns {Promise<Tx>}
   */
  async execute(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
    oracleAttestation: OracleAttestationV0,
    isOfferer: boolean,
  ): Promise<Tx> {
    return this.client.getMethod('execute')(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTxs,
      oracleAttestation,
      isOfferer,
    );
  }

  /**
   * Refund DLC
   * @param dlcOffer Dlc Offer Message
   * @param dlcAccept Dlc Accept Message
   * @param dlcSign Dlc Sign Message
   * @param dlcTxs Dlc Transactions message
   * @returns {Promise<Tx>}
   */
  async refund(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcSign: DlcSign,
    dlcTxs: DlcTransactions,
  ): Promise<Tx> {
    return this.client.getMethod('refund')(
      dlcOffer,
      dlcAccept,
      dlcSign,
      dlcTxs,
    );
  }

  /**
   * Generate PSBT for closing DLC with Mutual Consent
   * If no PSBT provided, assume initiator
   * If PSBT provided, assume reciprocator
   * @param dlcOffer DlcOffer TLV (V0)
   * @param dlcAccept DlcAccept TLV (V0)
   * @param dlcTxs DlcTransactions TLV (V0)
   * @param initiatorPayoutSatoshis Amount initiator expects as a payout
   * @param isOfferer Whether offerer or not
   * @param psbt Partially Signed Bitcoin Transaction
   * @param inputs Optionally specified closing inputs
   * @returns {Promise<Psbt>}
   */
  async close(
    dlcOffer: DlcOffer,
    dlcAccept: DlcAccept,
    dlcTxs: DlcTransactions,
    initiatorPayoutSatoshis: bigint,
    isOfferer: boolean,
    psbt?: Psbt,
    inputs?: IInput[],
  ): Promise<Psbt> {
    return this.client.getMethod('close')(
      dlcOffer,
      dlcAccept,
      dlcTxs,
      initiatorPayoutSatoshis,
      isOfferer,
      psbt,
      inputs,
    );
  }

  async AddSignatureToFundTransaction(
    jsonObject: AddSignatureToFundTransactionRequest,
  ): Promise<AddSignatureToFundTransactionResponse> {
    return this.client.getMethod('AddSignatureToFundTransaction')(jsonObject);
  }

  async CreateCetAdaptorSignature(
    jsonObject: CreateCetAdaptorSignatureRequest,
  ): Promise<CreateCetAdaptorSignatureResponse> {
    return this.client.getMethod('CreateCetAdaptorSignature')(jsonObject);
  }

  async CreateCetAdaptorSignatures(
    jsonObject: CreateCetAdaptorSignaturesRequest,
  ): Promise<CreateCetAdaptorSignaturesResponse> {
    return this.client.getMethod('CreateCetAdaptorSignatures')(jsonObject);
  }

  async AddSignaturesToRefundTx(
    jsonObject: AddSignaturesToRefundTxRequest,
  ): Promise<AddSignaturesToRefundTxResponse> {
    return this.client.getMethod('AddSignaturesToRefundTx')(jsonObject);
  }

  async CreateCet(jsonObject: CreateCetRequest): Promise<CreateCetResponse> {
    return this.client.getMethod('CreateCet')(jsonObject);
  }

  async CreateDlcTransactions(
    jsonObject: CreateDlcTransactionsRequest,
  ): Promise<CreateDlcTransactionsResponse> {
    return this.client.getMethod('CreateDlcTransactions')(jsonObject);
  }

  async CreateFundTransaction(
    jsonObject: CreateFundTransactionRequest,
  ): Promise<CreateFundTransactionResponse> {
    return this.client.getMethod('CreateFundTransaction')(jsonObject);
  }

  async CreateRefundTransaction(
    jsonObject: CreateRefundTransactionRequest,
  ): Promise<CreateRefundTransactionResponse> {
    return this.client.getMethod('CreateRefundTransaction')(jsonObject);
  }

  async GetRawFundTxSignature(
    jsonObject: GetRawFundTxSignatureRequest,
  ): Promise<GetRawFundTxSignatureResponse> {
    return this.client.getMethod('GetRawFundTxSignature')(jsonObject);
  }

  async GetRawRefundTxSignature(
    jsonObject: GetRawRefundTxSignatureRequest,
  ): Promise<GetRawRefundTxSignatureResponse> {
    return this.client.getMethod('GetRawRefundTxSignature')(jsonObject);
  }

  async SignCetRequest(jsonObject: SignCetRequest): Promise<SignCetResponse> {
    return this.client.getMethod('SignCetRequest')(jsonObject);
  }

  async SignFundTransaction(
    jsonObject: SignFundTransactionRequest,
  ): Promise<SignFundTransactionResponse> {
    return this.client.getMethod('SignFundTransaction')(jsonObject);
  }

  async VerifyCetAdaptorSignature(
    jsonObject: VerifyCetAdaptorSignatureRequest,
  ): Promise<VerifyCetAdaptorSignatureResponse> {
    return this.client.getMethod('VerifyCetAdaptorSignature')(jsonObject);
  }

  async VerifyCetAdaptorSignaturesRequest(
    jsonObject: VerifyCetAdaptorSignaturesRequest,
  ): Promise<VerifyCetAdaptorSignaturesResponse> {
    return this.client.getMethod('VerifyCetAdaptorSignatures')(jsonObject);
  }

  async VerifyFundTxSignature(
    jsonObject: VerifyFundTxSignatureRequest,
  ): Promise<VerifyFundTxSignatureResponse> {
    return this.client.getMethod('VerifyFundTxSignature')(jsonObject);
  }

  async VerifyRefundTxSignature(
    jsonObject: VerifyRefundTxSignatureRequest,
  ): Promise<VerifyRefundTxSignatureResponse> {
    return this.client.getMethod('VerifyRefundTxSignature')(jsonObject);
  }

  async fundingInputToInput(_input: FundingInput): Promise<IInput> {
    return this.client.getMethod('fundingInputToInput')(_input);
  }

  async inputToFundingInput(input: IInput): Promise<FundingInput> {
    return this.client.getMethod('inputToFundingInput')(input);
  }
}

export interface AcceptDlcOfferResponse {
  dlcAccept: DlcAccept;
  dlcTransactions: DlcTransactions;
}

export interface SignDlcAcceptResponse {
  dlcSign: DlcSign;
  dlcTransactions: DlcTransactions;
}

export interface IInput {
  txid: string;
  vout: number;
  address: string;
  amount: number; // in BTC
  value: number; // in sats
  derivationPath?: string;
  maxWitnessLength?: number;
  redeemScript?: string;
  inputSerialId?: bigint;
  scriptPubKey?: string;
  label?: string;
  confirmations?: number;
  spendable?: boolean;
  solvable?: boolean;
  safe?: boolean;
  toUtxo: any;
}
