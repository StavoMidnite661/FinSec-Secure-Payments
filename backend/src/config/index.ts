import 'dotenv/config';

function getEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === null) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export const config = {
  jwtSecret: getEnv('JWT_SECRET'),
  stripeSecretKey: getEnv('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: getEnv('STRIPE_WEBHOOK_SECRET'),
  sovrTokenAddress: getEnv('SOVR_TOKEN_ADDRESS'),
  honorVaultAddress: getEnv('HONOR_VAULT_ADDRESS'),
  rpcUrl: getEnv('RPC_URL'),
  retailerId: getEnv('RETAILER_ID'),
  port: process.env.PORT || 3000,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION,
  secretName: getEnv('SECRET_NAME'),
};