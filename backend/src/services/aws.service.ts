import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { config as appConfig } from "../config";

// Initialize the client only if all necessary AWS config is available.
const client = (appConfig.awsAccessKeyId && appConfig.awsSecretAccessKey && appConfig.awsRegion) 
  ? new SecretsManagerClient({
      region: appConfig.awsRegion,
      credentials: {
        accessKeyId: appConfig.awsAccessKeyId,
        secretAccessKey: appConfig.awsSecretAccessKey,
      },
    })
  : null;

export class AwsService {
  public static async getPrivateKey(): Promise<string> {
    // If the client was never initialized, throw a fatal error.
    if (!client) {
      throw new Error("AWS credentials are not configured. Cannot retrieve private key.");
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: appConfig.secretName,
      });

      const response = await client.send(command);

      if (response.SecretString) {
        // Standardize the secret format to be a JSON object with a 'privateKey' field.
        const secret = JSON.parse(response.SecretString);
        const key = secret.privateKey;

        if (key && typeof key === 'string') {
          // The ethers.Wallet constructor handles the '0x' prefix, so no stripping is needed.
          return key;
        }
        throw new Error("Invalid secret format: 'privateKey' not found in JSON payload.");
      }

      throw new Error("SecretString from AWS Secrets Manager is empty.");
    } catch (error) {
      console.error("Fatal error retrieving secret from AWS Secrets Manager:", error);
      // Re-throw to ensure the application startup fails.
      throw error;
    }
  }
}