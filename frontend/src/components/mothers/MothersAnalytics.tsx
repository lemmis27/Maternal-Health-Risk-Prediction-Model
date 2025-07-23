import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  useTheme,
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import { MotherData } from './EnhancedMothersList';

interface MothersAnalyticsProps {
  mothers: MotherData[];
}

const MothersAnalytics: React.FC<MothersAnalyticsProps> = ({ mothers }) => {
  const theme = useTheme();

  const analytics = useMemo(() => {
    // Risk distribution
    const riskDistribution = mothers.reduce((acc, mother) => {
      acc[mother.current_risk_level] = (acc[mother.current_risk_level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const riskChartData = [
      { name: 'High Risk', value: riskDistribution.high || 0, color: theme.palette.error.main },
      { name: 'Medium Risk', value: riskDistribution.medium || 0, color: theme.palette.warning.main },
      { name: 'Low Risk', value: riskDistribution.low || 0, color: theme.palette.success.main },
    ];

    // Age distribution
    const ageGroups = mothers.reduce((acc, mother) => {
      const ageGroup = mother.age < 20 ? '<20' : 
                     mother.age < 25 ? '20-24' :
                     mother.age < 30 ? '25-29' :
                     mother.age < 35 ? '30-34' :
                     mother.age < 40 ? '35-39' : '40+';
      acc[ageGroup] = (acc[ageGroup] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const ageChartData = Object.entries(ageGroups).map(([age, count]) => ({
      age,
      count,
      highRisk: mothers.filter(m => {
        const ageGroup = m.age < 20 ? '<20' : 
                        m.age < 25 ? '20-24' :
                        m.age < 30 ? '25-29' :
                        m.age < 35 ? '30-34' :
                        m.age < 40 ? '35-39' : '40+';
        return ageGroup === age && m.current_risk_level === 'high';
      }).length,
    }));

    // Gestational age distribution
    const gestationalAgeData = mothers
      .filter(m => m.gestational_age)
      .reduce((acc, mother) => {
        const week = Math.floor((mother.gestational_age || 0) / 4) * 4; // Group by 4-week periods
        const range = `${week}-${week + 3}w`;
        acc[range] = (acc[range] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const gestationalChartData = Object.entries(gestationalAgeData).map(([range, count]) => ({
      range,
      count,
    }));

    // Location distribution
    const locationData = mothers.reduce((acc, mother) => {
      const location = mother.location || 'Unknown';
      if (!acc[location]) {
        acc[location] = { total: 0, high: 0, medium: 0, low: 0 };
      }
      acc[location].total += 1;
      acc[location][mother.current_risk_level] += 1;
      return acc;
    }, {} as Record<string, { total: number; high: number; medium: number; low: number }>);

    const locationChartData = Object.entries(locationData).map(([location, data]) => ({
      location: location.length > 15 ? location.substring(0, 15) + '...' : location,
      total: (data as any).total,
      high: (data as any).high,
      medium: (data as any).medium,
      low: (data as any).low,
    }));

    // Assessment trends (last 30 days)
    const assessmentTrends = mothers
      .filter(m => m.last_assessment_date)
      .reduce((acc, mother) => {
        const date = new Date(mother.last_assessment_date!);
        const dayKey = date.toISOString().split('T')[0];
        if (!acc[dayKey]) {
          acc[dayKey] = { date: dayKey, assessments: 0, highRisk: 0 };
        }
        acc[dayKey].assessments += 1;
        if (mother.current_risk_level === 'high') {
          acc[dayKey].highRisk += 1;
        }
        return acc;
      }, {} as Record<string, { date: string; assessments: number; highRisk: number }>);

    const trendChartData = Object.values(assessmentTrends)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30); // Last 30 days

    return {
      riskChartData,
      ageChartData,
      gestationalChartData,
      locationChartData,
      trendChartData,
      summary: {
        totalMothers: mothers.length,
        averageAge: mothers.length > 0 ? Math.round(mothers.reduce((sum, m) => sum + m.age, 0) / mothers.length) : 0,
        averageGestationalAge: mothers.filter(m => m.gestational_age).length > 0 
          ? Math.round(mothers.filter(m => m.gestational_age).reduce((sum, m) => sum + (m.gestational_age || 0), 0) / mothers.filter(m => m.gestational_age).length)
          : 0,
        assessmentRate: mothers.length > 0 ? Math.round((mothers.filter(m => m.last_assessment_date).length / mothers.length) * 100) : 0,
      }
    };
  }, [mothers, theme]);

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Mothers Analytics Dashboard
      </Typography>

      {/* Summary Cards */}
      <Box 
        display="flex" 
        flexWrap="wrap" 
        gap={2} 
        sx={{ mb: 4 }}
      >
        <Box flex="1 1 250px" minWidth="250px">
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Mothers
              </Typography>
              <Typography variant="h4">
                {analytics.summary.totalMothers}
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box flex="1 1 250px" minWidth="250px">
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Average Age
              </Typography>
              <Typography variant="h4">
                {analytics.summary.averageAge} years
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box flex="1 1 250px" minWidth="250px">
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Avg. Gestational Age
              </Typography>
              <Typography variant="h4">
                {analytics.summary.averageGestationalAge} weeks
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box flex="1 1 250px" minWidth="250px">
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Assessment Rate
              </Typography>
              <Typography variant="h4">
                {analytics.summary.assessmentRate}%
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Charts */}
      <Box 
        display="flex" 
        flexWrap="wrap" 
        gap={3}
      >
        {/* Risk Distribution Pie Chart */}
        <Box flex="1 1 400px" minWidth="400px">
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Risk Level Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.riskChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.riskChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>

        {/* Age Distribution Bar Chart */}
        <Box flex="1 1 400px" minWidth="400px">
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Age Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.ageChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="age" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill={theme.palette.primary.main} name="Total" />
                  <Bar dataKey="highRisk" fill={theme.palette.error.main} name="High Risk" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>

        {/* Location Distribution */}
        <Box flex="1 1 400px" minWidth="400px">
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Distribution by Location
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.locationChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="location" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="high" stackId="a" fill={theme.palette.error.main} name="High Risk" />
                  <Bar dataKey="medium" stackId="a" fill={theme.palette.warning.main} name="Medium Risk" />
                  <Bar dataKey="low" stackId="a" fill={theme.palette.success.main} name="Low Risk" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>

        {/* Assessment Trends */}
        <Box flex="1 1 400px" minWidth="400px">
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Assessment Trends (Last 30 Days)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="assessments"
                    stackId="1"
                    stroke={theme.palette.primary.main}
                    fill={theme.palette.primary.main}
                    name="Total Assessments"
                  />
                  <Area
                    type="monotone"
                    dataKey="highRisk"
                    stackId="2"
                    stroke={theme.palette.error.main}
                    fill={theme.palette.error.main}
                    name="High Risk"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default MothersAnalytics;