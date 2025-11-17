import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Add a custom domain certificate to the Fly.io app
 * Only runs in staging/production environments
 */
export async function addFlyCertificate(domain: string): Promise<{ success: boolean; error?: string }> {
  const env = process.env.NODE_ENV;
  
  console.log(`[flyctl] addFlyCertificate called for domain: ${domain}`);
  console.log(`[flyctl] NODE_ENV: ${env}`);
  
  // Skip in development
  if (env === 'development') {
    console.log(`[flyctl] Skipping cert add - development environment`);
    return { success: true };
  }
  
  // Verify FLY_API_TOKEN is set
  const hasToken = !!process.env.FLY_API_TOKEN;
  console.log(`[flyctl] FLY_API_TOKEN present: ${hasToken}`);
  
  if (!hasToken) {
    console.error('[flyctl] ERROR: FLY_API_TOKEN environment variable is not set');
    return {
      success: false,
      error: 'FLY_API_TOKEN is not configured. Please set it as a secret in your Fly.io app.'
    };
  }
  
  try {
    console.log(`[flyctl] Executing: flyctl certs add ${domain}`);
    const { stdout, stderr } = await execAsync(`flyctl certs add ${domain}`);
    
    console.log(`[flyctl] SUCCESS - Certificate added for ${domain}`);
    console.log(`[flyctl] stdout:`, stdout);
    
    if (stderr) {
      console.warn(`[flyctl] stderr:`, stderr);
    }
    
    return { success: true };
  } catch (error: any) {
    console.error(`[flyctl] ERROR - Failed to add certificate for ${domain}`);
    console.error(`[flyctl] Error message:`, error.message);
    console.error(`[flyctl] Error stack:`, error.stack);
    console.error(`[flyctl] Full error:`, error);
    
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
  
  console.log(`[flyctl] removeFlyCertificate called for domain: ${domain}`);
  console.log(`[flyctl] NODE_ENV: ${env}`);
  
  // Skip in development
  if (env === 'development') {
    console.log(`[flyctl] Skipping cert remove - development environment`);
    return { success: true };
  }
  
  // Verify FLY_API_TOKEN is set
  const hasToken = !!process.env.FLY_API_TOKEN;
  console.log(`[flyctl] FLY_API_TOKEN present: ${hasToken}`);
  
  if (!hasToken) {
    console.error('[flyctl] ERROR: FLY_API_TOKEN environment variable is not set');
    return {
      success: false,
      error: 'FLY_API_TOKEN is not configured. Please set it as a secret in your Fly.io app.'
    };
  }
  
  try {
    console.log(`[flyctl] Executing: flyctl certs remove ${domain} -y`);
    const { stdout, stderr } = await execAsync(`flyctl certs remove ${domain} -y`);
    
    console.log(`[flyctl] SUCCESS - Certificate removed for ${domain}`);
    console.log(`[flyctl] stdout:`, stdout);
    
    if (stderr) {
      console.warn(`[flyctl] stderr:`, stderr);
    }
    
    return { success: true };
  } catch (error: any) {
    console.error(`[flyctl] ERROR - Failed to remove certificate for ${domain}`);
    console.error(`[flyctl] Error message:`, error.message);
    console.error(`[flyctl] Error stack:`, error.stack);
    console.error(`[flyctl] Full error:`, error);
    
    return { 
      success: false, 
      error: error.message || 'Failed to remove certificate' 
    };
  }
}
