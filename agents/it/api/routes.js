/**
 * Data Analytics API Routes
 *
 * Express route handlers for the dashboard API (port 3002).
 * Provides daily, weekly, monthly metrics, natural language queries,
 * and data export endpoints.
 */

const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('it-data-analytics-api');

/**
 * Register all API routes on the Express app.
 */
function register(app, handlers) {
  const {
    aggregateDailyMetrics,
    generateDailyReport,
    generateWeeklyReport,
    generateMonthlyReport,
    handleNaturalLanguageQuery,
    exportToCSV,
    exportToJSON,
    getDailyMetrics,
    getMetricsRange,
    aggregateMetricsRange,
    runDataQualityChecks,
  } = handlers;

  // ── Health Check ─────────────────────────────────────────────────────────

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'werkpilot-data-analytics',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // ── GET /api/daily ───────────────────────────────────────────────────────

  app.get('/api/daily', async (req, res) => {
    try {
      const date = req.query.date || new Date().toISOString().slice(0, 10);
      logger.info(`API: Fetching daily metrics for ${date}`);

      const metrics = await getDailyMetrics(date);
      if (!metrics) {
        // If no cached metrics, aggregate fresh
        const freshMetrics = await aggregateDailyMetrics();
        return res.json({
          success: true,
          date,
          metrics: freshMetrics,
          cached: false,
        });
      }

      res.json({
        success: true,
        date,
        metrics,
        cached: true,
      });
    } catch (error) {
      logger.error(`API /daily error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ── GET /api/weekly ──────────────────────────────────────────────────────

  app.get('/api/weekly', async (req, res) => {
    try {
      const weeksBack = parseInt(req.query.weeks) || 1;
      const endDate = new Date();
      const startDate = new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000);

      logger.info(`API: Fetching weekly metrics (${weeksBack} week(s) back)`);

      const data = await getMetricsRange(startDate, endDate);
      const totals = aggregateMetricsRange(data);

      res.json({
        success: true,
        period: {
          start: startDate.toISOString().slice(0, 10),
          end: endDate.toISOString().slice(0, 10),
          weeks: weeksBack,
        },
        totals,
        dailyBreakdown: data,
      });
    } catch (error) {
      logger.error(`API /weekly error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ── GET /api/monthly ─────────────────────────────────────────────────────

  app.get('/api/monthly', async (req, res) => {
    try {
      const month = req.query.month; // format: YYYY-MM
      let startDate, endDate;

      if (month) {
        const [year, m] = month.split('-').map(Number);
        startDate = new Date(year, m - 1, 1);
        endDate = new Date(year, m, 0);
      } else {
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      }

      logger.info(`API: Fetching monthly metrics for ${startDate.toISOString().slice(0, 7)}`);

      const data = await getMetricsRange(startDate, endDate);
      const totals = aggregateMetricsRange(data);

      res.json({
        success: true,
        period: {
          month: startDate.toISOString().slice(0, 7),
          start: startDate.toISOString().slice(0, 10),
          end: endDate.toISOString().slice(0, 10),
        },
        totals,
        dailyBreakdown: data,
      });
    } catch (error) {
      logger.error(`API /monthly error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ── GET /api/query ───────────────────────────────────────────────────────

  app.get('/api/query', async (req, res) => {
    try {
      const question = req.query.q;
      if (!question) {
        return res.status(400).json({
          success: false,
          error: 'Missing query parameter "q". Example: /api/query?q=How many new leads this week?',
        });
      }

      logger.info(`API: Natural language query: "${question}"`);

      const result = await handleNaturalLanguageQuery(question);

      res.json({
        success: true,
        question,
        ...result,
      });
    } catch (error) {
      logger.error(`API /query error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ── POST /api/query ──────────────────────────────────────────────────────

  app.post('/api/query', async (req, res) => {
    try {
      const { question } = req.body;
      if (!question) {
        return res.status(400).json({
          success: false,
          error: 'Missing "question" field in request body',
        });
      }

      logger.info(`API: Natural language query (POST): "${question}"`);

      const result = await handleNaturalLanguageQuery(question);

      res.json({
        success: true,
        question,
        ...result,
      });
    } catch (error) {
      logger.error(`API /query POST error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ── GET /api/export ──────────────────────────────────────────────────────

  app.get('/api/export', async (req, res) => {
    try {
      const format = req.query.format || 'json';
      const type = req.query.type || 'daily';
      const days = parseInt(req.query.days) || 30;

      logger.info(`API: Exporting ${type} data as ${format} (${days} days)`);

      const endDate = new Date();
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const data = await getMetricsRange(startDate, endDate);

      if (format === 'csv') {
        const csv = exportToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=werkpilot-${type}-${days}d.csv`);
        return res.send(csv);
      }

      res.json({
        success: true,
        format: 'json',
        type,
        days,
        recordCount: data.length,
        data,
      });
    } catch (error) {
      logger.error(`API /export error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ── GET /api/quality ─────────────────────────────────────────────────────

  app.get('/api/quality', async (req, res) => {
    try {
      logger.info('API: Running data quality checks');
      const issues = await runDataQualityChecks();

      res.json({
        success: true,
        totalIssues: issues.length,
        duplicates: issues.filter(i => i.type === 'duplicate').length,
        missingFields: issues.filter(i => i.type === 'missing').length,
        invalidData: issues.filter(i => i.type === 'invalid').length,
        issues: issues.slice(0, 100),
      });
    } catch (error) {
      logger.error(`API /quality error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ── GET /api/anomalies ───────────────────────────────────────────────────

  app.get('/api/anomalies', async (req, res) => {
    try {
      const { getRecords } = require('../../shared/utils/airtable-client');
      const days = parseInt(req.query.days) || 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const anomalies = await getRecords('Anomalies', `{DetectedAt} >= "${since}"`);

      res.json({
        success: true,
        days,
        count: anomalies.length,
        anomalies,
      });
    } catch (error) {
      logger.error(`API /anomalies error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  logger.info('API routes registered successfully');
}

module.exports = { register };
