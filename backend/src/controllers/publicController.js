const db = require('../config/db');
const redisClient = require('../config/redis');

const healthCheck = async (req, res) => {
  try {
    const dbRes = await db.query('SELECT 1 as healthy');
    const redisStatus = await redisClient.ping().then(() => 'connected').catch(() => 'disconnected');
    
    const status = dbRes.rows[0].healthy === 1 && redisStatus === 'connected' ? 'UP' : 'DOWN';
    
    res.json({
      status,
      service: 'MexxicanMX API',
      timestamp: new Date().toISOString(),
      components: {
        database: dbRes.rows[0].healthy === 1 ? 'connected' : 'disconnected',
        redis: redisStatus
      }
    });
  } catch (err) {
    res.status(503).json({
      status: 'DOWN',
      service: 'MexxicanMX API',
      timestamp: new Date().toISOString(),
      error: err.message
    });
  }
};

const { getPublicMenu, getPublicRecommendations } = require('../controllers/menuController');

module.exports = { healthCheck, getPublicMenu, getPublicRecommendations };
