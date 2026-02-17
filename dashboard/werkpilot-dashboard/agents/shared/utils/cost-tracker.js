/**
 * AI Cost Management System
 * Tracks Claude API costs per agent, department, and time period
 */

const fs = require('fs').promises;
const path = require('path');

class CostTracker {
  constructor() {
    // Model pricing per 1M tokens (input/output)
    this.pricing = {
      haiku: {
        input: 0.25, // $0.25 per 1M input tokens
        output: 1.25, // $1.25 per 1M output tokens
      },
      sonnet: {
        input: 3.0, // $3 per 1M input tokens
        output: 15.0, // $15 per 1M output tokens
      },
      opus: {
        input: 15.0, // $15 per 1M input tokens
        output: 75.0, // $75 per 1M output tokens
      },
    };

    // Department budget allocation (monthly)
    this.budgets = {
      sales: 500, // $500/month
      marketing: 300, // $300/month
      operations: 200, // $200/month
      support: 150, // $150/month
      default: 100, // $100/month for others
    };

    this.costs = {
      agents: new Map(),
      departments: new Map(),
      daily: new Map(),
      weekly: new Map(),
      monthly: new Map(),
    };

    this.dataDir = path.join(__dirname, '../../../data/costs');
  }

  /**
   * Initialize cost tracker
   */
  async init() {
    await this.ensureDataDir();
    await this.loadHistoricalData();
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create costs directory:', error);
    }
  }

  /**
   * Calculate cost for a token usage
   */
  calculateCost(model, inputTokens, outputTokens) {
    const modelName = model.toLowerCase().includes('opus')
      ? 'opus'
      : model.toLowerCase().includes('sonnet')
      ? 'sonnet'
      : 'haiku';

    const pricing = this.pricing[modelName];
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * Track cost for an agent execution
   */
  trackCost(agentName, department, data) {
    const { model = 'haiku', inputTokens = 0, outputTokens = 0, tokensUsed = 0 } = data;

    // If only total tokens provided, split 50/50
    const input = inputTokens || Math.floor(tokensUsed / 2);
    const output = outputTokens || Math.ceil(tokensUsed / 2);

    const cost = this.calculateCost(model, input, output);
    const timestamp = Date.now();
    const date = new Date().toISOString().split('T')[0];
    const week = this.getWeekKey(new Date());
    const month = date.substring(0, 7); // YYYY-MM

    // Initialize agent tracking
    if (!this.costs.agents.has(agentName)) {
      this.costs.agents.set(agentName, {
        name: agentName,
        department,
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        executions: 0,
        modelUsage: {},
        lastUsed: null,
      });
    }

    const agent = this.costs.agents.get(agentName);
    agent.totalCost += cost;
    agent.totalInputTokens += input;
    agent.totalOutputTokens += output;
    agent.executions++;
    agent.lastUsed = timestamp;

    // Track model usage
    if (!agent.modelUsage[model]) {
      agent.modelUsage[model] = { cost: 0, executions: 0 };
    }
    agent.modelUsage[model].cost += cost;
    agent.modelUsage[model].executions++;

    // Track department costs
    if (!this.costs.departments.has(department)) {
      this.costs.departments.set(department, {
        name: department,
        totalCost: 0,
        agents: new Set(),
        budget: this.budgets[department] || this.budgets.default,
      });
    }

    const dept = this.costs.departments.get(department);
    dept.totalCost += cost;
    dept.agents.add(agentName);

    // Track daily costs
    if (!this.costs.daily.has(date)) {
      this.costs.daily.set(date, {
        date,
        totalCost: 0,
        executions: 0,
        agents: new Map(),
        departments: new Map(),
      });
    }

    const daily = this.costs.daily.get(date);
    daily.totalCost += cost;
    daily.executions++;

    if (!daily.agents.has(agentName)) {
      daily.agents.set(agentName, 0);
    }
    daily.agents.set(agentName, daily.agents.get(agentName) + cost);

    if (!daily.departments.has(department)) {
      daily.departments.set(department, 0);
    }
    daily.departments.set(department, daily.departments.get(department) + cost);

    // Track weekly costs
    if (!this.costs.weekly.has(week)) {
      this.costs.weekly.set(week, {
        week,
        totalCost: 0,
        executions: 0,
      });
    }

    const weekly = this.costs.weekly.get(week);
    weekly.totalCost += cost;
    weekly.executions++;

    // Track monthly costs
    if (!this.costs.monthly.has(month)) {
      this.costs.monthly.set(month, {
        month,
        totalCost: 0,
        executions: 0,
      });
    }

    const monthly = this.costs.monthly.get(month);
    monthly.totalCost += cost;
    monthly.executions++;

    // Check budget alerts
    this.checkBudgetAlerts(department);

    return {
      cost,
      totalCostToday: daily.totalCost,
      totalCostThisMonth: monthly.totalCost,
      departmentCost: dept.totalCost,
      departmentBudget: dept.budget,
    };
  }

  /**
   * Get week key (YYYY-WW format)
   */
  getWeekKey(date) {
    const year = date.getFullYear();
    const firstDay = new Date(year, 0, 1);
    const dayOfYear = Math.floor((date - firstDay) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((dayOfYear + firstDay.getDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  /**
   * Check budget alerts
   */
  checkBudgetAlerts(department) {
    const dept = this.costs.departments.get(department);
    if (!dept) return;

    const month = new Date().toISOString().substring(0, 7);
    const monthly = this.costs.monthly.get(month);
    if (!monthly) return;

    const deptMonthCost = this.getDepartmentMonthlyCost(department, month);
    const budget = dept.budget;
    const percentage = (deptMonthCost / budget) * 100;

    if (percentage >= 100) {
      this.emitAlert({
        level: 'critical',
        type: 'budget_exceeded',
        message: `Department ${department} has exceeded monthly budget: $${deptMonthCost.toFixed(2)} / $${budget}`,
        department,
        cost: deptMonthCost,
        budget,
        percentage,
      });
    } else if (percentage >= 90) {
      this.emitAlert({
        level: 'warning',
        type: 'budget_warning',
        message: `Department ${department} is at ${percentage.toFixed(0)}% of monthly budget: $${deptMonthCost.toFixed(2)} / $${budget}`,
        department,
        cost: deptMonthCost,
        budget,
        percentage,
      });
    } else if (percentage >= 75) {
      this.emitAlert({
        level: 'info',
        type: 'budget_info',
        message: `Department ${department} is at ${percentage.toFixed(0)}% of monthly budget: $${deptMonthCost.toFixed(2)} / $${budget}`,
        department,
        cost: deptMonthCost,
        budget,
        percentage,
      });
    }
  }

  /**
   * Get department monthly cost
   */
  getDepartmentMonthlyCost(department, month) {
    let total = 0;
    for (const agent of this.costs.agents.values()) {
      if (agent.department === department) {
        // Sum up daily costs for this month
        for (const [date, daily] of this.costs.daily.entries()) {
          if (date.startsWith(month) && daily.agents.has(agent.name)) {
            total += daily.agents.get(agent.name);
          }
        }
      }
    }
    return total;
  }

  /**
   * Emit alert to alert manager
   */
  emitAlert(alert) {
    if (global.alertManager) {
      global.alertManager.addAlert(alert);
    }
  }

  /**
   * Get cost for a specific agent
   */
  getAgentCost(agentName) {
    return this.costs.agents.get(agentName) || null;
  }

  /**
   * Get cost for a specific department
   */
  getDepartmentCost(department) {
    const dept = this.costs.departments.get(department);
    if (!dept) return null;

    const agents = [];
    for (const agent of this.costs.agents.values()) {
      if (agent.department === department) {
        agents.push(agent);
      }
    }

    return {
      ...dept,
      agents: agents.sort((a, b) => b.totalCost - a.totalCost),
      budgetUsed: (dept.totalCost / dept.budget) * 100,
    };
  }

  /**
   * Get daily cost report
   */
  getDailyCostReport(date) {
    const dateKey = date || new Date().toISOString().split('T')[0];
    const daily = this.costs.daily.get(dateKey);

    if (!daily) {
      return {
        date: dateKey,
        totalCost: 0,
        executions: 0,
        agents: [],
        departments: [],
      };
    }

    const agents = Array.from(daily.agents.entries())
      .map(([name, cost]) => ({ name, cost }))
      .sort((a, b) => b.cost - a.cost);

    const departments = Array.from(daily.departments.entries())
      .map(([name, cost]) => ({ name, cost }))
      .sort((a, b) => b.cost - a.cost);

    return {
      date: dateKey,
      totalCost: daily.totalCost,
      executions: daily.executions,
      agents,
      departments,
    };
  }

  /**
   * Get weekly cost report
   */
  getWeeklyCostReport(week) {
    const weekKey = week || this.getWeekKey(new Date());
    const weekly = this.costs.weekly.get(weekKey);

    if (!weekly) {
      return {
        week: weekKey,
        totalCost: 0,
        executions: 0,
      };
    }

    return { ...weekly };
  }

  /**
   * Get monthly cost report
   */
  getMonthlyCostReport(month) {
    const monthKey = month || new Date().toISOString().substring(0, 7);
    const monthly = this.costs.monthly.get(monthKey);

    if (!monthly) {
      return {
        month: monthKey,
        totalCost: 0,
        executions: 0,
      };
    }

    // Get department breakdown for this month
    const departments = [];
    for (const [deptName, dept] of this.costs.departments.entries()) {
      const cost = this.getDepartmentMonthlyCost(deptName, monthKey);
      if (cost > 0) {
        departments.push({
          name: deptName,
          cost,
          budget: dept.budget,
          budgetUsed: (cost / dept.budget) * 100,
        });
      }
    }

    return {
      ...monthly,
      departments: departments.sort((a, b) => b.cost - a.cost),
    };
  }

  /**
   * Get cost optimization suggestions
   */
  getCostOptimizations() {
    const suggestions = [];

    for (const agent of this.costs.agents.values()) {
      // Check if agent is using expensive models unnecessarily
      const opusCost = agent.modelUsage['opus']?.cost || 0;
      const sonnetCost = agent.modelUsage['sonnet']?.cost || 0;
      const haikuCost = agent.modelUsage['haiku']?.cost || 0;

      if (opusCost > 0 && agent.executions > 100) {
        // Potential savings if switched to Sonnet
        const opusExecs = agent.modelUsage['opus'].executions;
        const potentialSavings = opusCost * 0.8; // ~80% savings from Opus to Sonnet

        suggestions.push({
          agent: agent.name,
          type: 'model_downgrade',
          message: `Consider using Sonnet instead of Opus for ${agent.name}`,
          currentModel: 'opus',
          suggestedModel: 'sonnet',
          currentCost: opusCost,
          potentialSavings,
          executions: opusExecs,
        });
      }

      if (sonnetCost > 0 && agent.executions > 100) {
        // Check if tasks are simple enough for Haiku
        const avgCostPerExec = agent.totalCost / agent.executions;
        if (avgCostPerExec < 0.001) {
          // Very cheap tasks, might be suitable for Haiku
          const potentialSavings = sonnetCost * 0.7; // ~70% savings from Sonnet to Haiku

          suggestions.push({
            agent: agent.name,
            type: 'model_downgrade',
            message: `Consider using Haiku instead of Sonnet for ${agent.name}`,
            currentModel: 'sonnet',
            suggestedModel: 'haiku',
            currentCost: sonnetCost,
            potentialSavings,
            executions: agent.executions,
          });
        }
      }
    }

    return suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Generate daily cost report
   */
  async generateDailyCostReport() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const todayReport = this.getDailyCostReport(today);
    const yesterdayReport = this.getDailyCostReport(yesterday);

    const report = {
      date: today,
      summary: {
        totalCost: todayReport.totalCost,
        executions: todayReport.executions,
        avgCostPerExecution: todayReport.executions > 0 ? todayReport.totalCost / todayReport.executions : 0,
        changeFromYesterday: todayReport.totalCost - yesterdayReport.totalCost,
        changePercentage:
          yesterdayReport.totalCost > 0
            ? ((todayReport.totalCost - yesterdayReport.totalCost) / yesterdayReport.totalCost) * 100
            : 0,
      },
      topAgents: todayReport.agents.slice(0, 10),
      departments: todayReport.departments,
      optimizations: this.getCostOptimizations(),
    };

    // Save report to disk
    await this.saveDailyReport(report);

    return report;
  }

  /**
   * Save daily report to disk
   */
  async saveDailyReport(report) {
    try {
      const filename = `daily-cost-${report.date}.json`;
      const filepath = path.join(this.dataDir, filename);
      await fs.writeFile(filepath, JSON.stringify(report, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save daily cost report:', error);
    }
  }

  /**
   * Load historical data
   */
  async loadHistoricalData() {
    try {
      const files = await fs.readdir(this.dataDir);
      const reports = files.filter((f) => f.startsWith('daily-cost-'));

      for (const file of reports) {
        const filepath = path.join(this.dataDir, file);
        const data = await fs.readFile(filepath, 'utf8');
        const report = JSON.parse(data);

        // Restore daily costs
        if (!this.costs.daily.has(report.date)) {
          this.costs.daily.set(report.date, {
            date: report.date,
            totalCost: report.summary.totalCost,
            executions: report.summary.executions,
            agents: new Map(),
            departments: new Map(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to load historical data:', error);
    }
  }

  /**
   * Set department budget
   */
  setDepartmentBudget(department, budget) {
    this.budgets[department] = budget;

    if (this.costs.departments.has(department)) {
      const dept = this.costs.departments.get(department);
      dept.budget = budget;
    }
  }

  /**
   * Get all costs summary
   */
  getAllCosts() {
    const agents = Array.from(this.costs.agents.values()).sort((a, b) => b.totalCost - a.totalCost);

    const departments = [];
    for (const [name, dept] of this.costs.departments.entries()) {
      departments.push(this.getDepartmentCost(name));
    }

    return {
      agents,
      departments: departments.sort((a, b) => b.totalCost - a.totalCost),
      daily: this.getDailyCostReport(),
      weekly: this.getWeeklyCostReport(),
      monthly: this.getMonthlyCostReport(),
      optimizations: this.getCostOptimizations(),
    };
  }
}

// Singleton instance
let instance = null;

function getCostTracker() {
  if (!instance) {
    instance = new CostTracker();
    instance.init();
  }
  return instance;
}

module.exports = {
  CostTracker,
  getCostTracker,
};
