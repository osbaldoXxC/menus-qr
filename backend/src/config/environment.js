const startupDdlDisabled = () => process.env.NODE_ENV === 'development' && process.env.DISABLE_STARTUP_DDL === 'true';

const validateEnvironment = () => {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (process.env.JWT_SECRET?.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  
  if (process.env.REFRESH_TOKEN_SECRET?.length < 32) {
    throw new Error('REFRESH_TOKEN_SECRET must be at least 32 characters long');
  }
  
  console.log('[Environment] All critical variables validated');
};

module.exports = { validateEnvironment, startupDdlDisabled };
