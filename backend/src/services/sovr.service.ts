import { ethers } from "ethers";
import POSCreditTokenABI from "../../../abis/POSCreditToken.json";
import { config } from "../config";
import { AwsService } from "./aws.service";

export class SOVRService {
  private provider: ethers.JsonRpcProvider | ethers.WebSocketProvider;
  private signer!: ethers.Wallet; // Definite assignment assertion
  private sovrToken!: ethers.Contract; // Definite assignment assertion

  private constructor() {
    // Provider RPC (Ethereum, Polygon, etc.)
    if (config.rpcUrl.startsWith('wss')) {
      this.provider = new ethers.WebSocketProvider(config.rpcUrl);
    } else {
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    }
  }

  public static async create(): Promise<SOVRService> {
    const instance = new SOVRService();
    await instance.initialize();
    return instance;
  }

  private async initialize(): Promise<void> {
    // Fetch the private key securely from AWS Secrets Manager
    const privateKey = await AwsService.getPrivateKey();

    // Signer
    this.signer = new ethers.Wallet(privateKey, this.provider);

    // Contracts
    this.sovrToken = new ethers.Contract(
      config.sovrTokenAddress,
      POSCreditTokenABI.abi,
      this.signer // signer attached for write txs
    );
  }

  // Existing balanceOf
  async getBalance(addr: string) {
    return await this.sovrToken.balanceOf(addr);
  }

  // New: Sacrifice (burn) SOVR
  async sacrificeSOVR(userAddress: string, amount: string, retailerId: string, complianceHash: string) {
    try {
      // Amount should be formatted into Wei. Assuming 18 decimals for the token.
      const parsedAmount = ethers.parseUnits(amount, 18);
      // The retailerId must be converted to a bytes32 value to be used as the merchantId
      const merchantId = ethers.id(retailerId);

      console.log(`Calling burnForPOS with from: ${userAddress}, merchantId: ${merchantId}, amount: ${parsedAmount}`);

      // Call the correct burnForPOS function on the SOVRCreditBridgePOS contract
      const tx = await this.sovrToken.burnForPOS(userAddress, merchantId, parsedAmount);

      // Wait for confirmation
      const receipt = await tx.wait();

      return {
        status: "BURNED",
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        amount,
        retailerId,
        complianceHash
      };
    } catch (err: any) {
      console.error("Sacrifice failed:", err);
      throw new Error(`SacrificeSOVR error: ${err.message}`);
    }
  }
}