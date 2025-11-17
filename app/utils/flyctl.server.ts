import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Add a custom domain certificate to the Fly.io app
 * Only runs in staging/production environments
 */
export async function addFlyCertificate(domain: string): Promise<{ success: boolean; error?: string }> {
  const env = process.env.NODE_ENV;
  
  // Skip in development
  if (env === 'development') {
    console.log(`[DEV] Skipping flyctl cert add for domain: ${domain}`);
    return { success: true };
  }
  
  // Verify FLY_API_TOKEN is set
  if (!process.env.FLY_API_TOKEN) {
    console.error('[flyctl] FLY_API_TOKEN environment variable is not set');
    return {
      success: false,
      error: 'FLY_API_TOKEN is not configured. Please set it as a secret in your Fly.io app.'
    };
  }
  
  try {
    const { stdout, stderr } = await execAsync(`flyctl certs add ${domain}`);
    console.log(`[flyctl] Certificate added for ${domain}:`, stdout);
    
    if (stderr) {
      console.warn(`[flyctl] stderr:`, stderr);
    }
    
    return { success: true };
  } catch (error: any) {
    console.error(`[flyctl] Failed to add certificate for ${domain}:`, error);
    return { 
      success: false, 
      error: error.message || 'Failed to add certificate' 
    };
  }
}

/**
 * Remove a custom domain certificate from the Fly.io app
 * Only runs in staging/production environments
 */
export async function removeFlyCertificate(domain: string): Promise<{ success: boolean; error?: string }> {
  const env = process.env.NODE_ENV;
  
  // Skip in development
  if (env === 'development') {
    console.log(`[DEV] Skipping flyctl cert remove for domain: ${domain}`);
    return { success: true };
  }
  
  // Verify FLY_API_TOKEN is set
  if (!process.env.FLY_API_TOKEN) {
    console.error('[flyctl] FLY_API_TOKEN environment variable is not set');
    return {
      success: false,
      error: 'FLY_API_TOKEN is not configured. Please set it as a secret in your Fly.io app.'
    };
  }
  
  try {
    const { stdout, stderr } = await execAsync(`flyctl certs remove ${domain} -y`);
    console.log(`[flyctl] Certificate removed for ${domain}:`, stdout);
    
    if (stderr) {
      console.warn(`[flyctl] stderr:`, stderr);
    }
    
    return { success: true };
  } catch (error: any) {
    console.error(`[flyctl] Failed to remove certificate for ${domain}:`, error);
    return { 
      success: false, 
      error: error.message || 'Failed to remove certificate' 
    };
  }
}
