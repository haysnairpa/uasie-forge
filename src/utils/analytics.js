class TimeSeriesAnalyzer {
    constructor(windowSize) {
      this.windowSize = windowSize; // in milliseconds
      this.dataPoints = [];
    }
  
    addDataPoint(timestamp, value) {
      this.dataPoints.push({ timestamp, value });
      // Keep only data points within window
      const cutoff = Date.now() / 1000 - this.windowSize / 1000;
      this.dataPoints = this.dataPoints.filter(point => point.timestamp >= cutoff);
    }
  
    getDailyData() {
      const dailyData = new Array(7).fill(0);
      const now = Date.now() / 1000;
      
      this.dataPoints.forEach(point => {
        const daysAgo = Math.floor((now - point.timestamp) / (24 * 60 * 60));
        if (daysAgo < 7) {
          dailyData[6 - daysAgo] += point.value;
        }
      });
      
      return dailyData;
    }
  
    getMaxValue() {
      return Math.max(...this.getDailyData(), 1);
    }
  
    calculateMovingAverage() {
      const values = this.getDailyData();
      return values.reduce((a, b) => a + b, 0) / values.length;
    }
  
    findTrend() {
      const values = this.getDailyData();
      let increasing = 0;
      let decreasing = 0;
  
      for (let i = 1; i < values.length; i++) {
        if (values[i] > values[i-1]) increasing++;
        else if (values[i] < values[i-1]) decreasing++;
      }
  
      if (increasing > decreasing) return 'increasing';
      if (decreasing > increasing) return 'decreasing';
      return 'stable';
    }
  }
  
  export default TimeSeriesAnalyzer;