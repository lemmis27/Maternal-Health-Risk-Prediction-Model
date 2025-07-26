import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Typography,
  Paper,
  Chip,
  IconButton,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Psychology as AIIcon,
  Close as CloseIcon,
  Send as SendIcon,
  Help as HelpIcon,
  MonitorHeart,
  Bloodtype,
  Speed,
  Thermostat
} from '@mui/icons-material';

interface AssessmentGuideBotProps {
  currentStep?: string;
  formData?: any;
}

const AssessmentGuideBot: React.FC<AssessmentGuideBotProps> = ({
  currentStep,
  formData
}) => {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');

  const generateGuidance = (userQuestion: string) => {
    const q = userQuestion.toLowerCase();
    
    if (q.includes('blood pressure') || q.includes('bp')) {
      return `**Blood Pressure Guidelines:**
      
• **Normal**: Less than 140/90 mmHg
• **High**: 140/90 mmHg or higher
• **Severe**: 160/110 mmHg or higher (immediate attention needed)

**Tips for accurate measurement:**
- Patient should rest for 5 minutes before measurement
- Use appropriate cuff size
- Take 2-3 readings and average them
- Note if patient is anxious or stressed`;
    }

    if (q.includes('blood sugar') || q.includes('glucose')) {
      return `**Blood Sugar Guidelines:**
      
• **Normal fasting**: 3.5-5.5 mmol/L
• **Normal random**: Less than 7.8 mmol/L
• **Gestational diabetes risk**: Fasting >5.1 mmol/L or Random >7.8 mmol/L

**Important notes:**
- Time since last meal affects readings
- Stress can elevate glucose levels
- Consider gestational diabetes screening if elevated`;
    }

    if (q.includes('heart rate') || q.includes('pulse')) {
      return `**Heart Rate Guidelines:**
      
• **Normal pregnancy**: 60-100 bpm (may be slightly elevated)
• **Concerning**: >120 bpm or <50 bpm
• **Emergency**: >150 bpm or irregular rhythm

**Assessment tips:**
- Count for full 60 seconds for accuracy
- Note rhythm regularity
- Consider patient activity level and anxiety`;
    }

    if (q.includes('temperature') || q.includes('fever')) {
      return `**Body Temperature Guidelines:**
      
• **Normal**: 97.0-99.5°F (36.1-37.5°C)
• **Low-grade fever**: 99.6-100.4°F (37.6-38.0°C)
• **Fever**: >100.4°F (>38.0°C)

**Clinical significance:**
- Fever may indicate infection
- Hypothermia (<97°F) can be concerning
- Consider environmental factors`;
    }

    if (q.includes('risk') || q.includes('assessment')) {
      return `**Risk Assessment Process:**
      
1. **Gather all vital signs** accurately
2. **Note patient symptoms** and concerns
3. **Consider gestational age** and pregnancy history
4. **Review previous assessments** for trends
5. **Use clinical judgment** alongside AI predictions

**Risk levels mean:**
• **High**: Immediate medical attention needed
• **Medium**: Close monitoring required
• **Low**: Routine prenatal care sufficient`;
    }

    return `I can help with:
• Blood pressure measurement and interpretation
• Blood sugar guidelines and gestational diabetes
• Heart rate assessment during pregnancy
• Body temperature evaluation
• Overall risk assessment process

Ask me about any specific vital sign or assessment step!`;
  };

  const handleAskQuestion = () => {
    if (!question.trim()) return;
    const guidance = generateGuidance(question);
    setResponse(guidance);
    setQuestion('');
  };

  const quickGuides = [
    { icon: <Speed />, text: "Blood pressure ranges", query: "blood pressure guidelines" },
    { icon: <Bloodtype />, text: "Blood sugar levels", query: "blood sugar normal ranges" },
    { icon: <MonitorHeart />, text: "Heart rate assessment", query: "heart rate guidelines" },
    { icon: <Thermostat />, text: "Temperature evaluation", query: "body temperature ranges" }
  ];

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<HelpIcon />}
        onClick={() => setOpen(true)}
        size="small"
        sx={{ mt: 2 }}
      >
        Assessment Guide
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AIIcon color="primary" />
          Assessment Guide Assistant
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Get guidance on vital signs interpretation, normal ranges, and assessment best practices.
            </Typography>
          </Alert>

          {/* Quick Guide Buttons */}
          <Typography variant="subtitle2" gutterBottom>
            Quick Guides:
          </Typography>
          <List dense sx={{ mb: 2 }}>
            {quickGuides.map((guide, index) => (
              <ListItem 
                key={index}
                sx={{ border: '1px solid', borderColor: 'grey.300', borderRadius: 1, mb: 1, p: 0 }}
              >
                <ListItemButton onClick={() => setQuestion(guide.query)}>
                  <ListItemIcon>{guide.icon}</ListItemIcon>
                  <ListItemText primary={guide.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          {/* Question Input */}
          <Box display="flex" gap={1} mb={2}>
            <TextField
              fullWidth
              placeholder="Ask about vital signs, normal ranges, or assessment procedures..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
            />
            <Button
              variant="contained"
              onClick={handleAskQuestion}
              disabled={!question.trim()}
            >
              <SendIcon />
            </Button>
          </Box>

          {/* AI Response */}
          {response && (
            <Paper sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <HelpIcon color="info" />
                <Typography variant="subtitle2" color="info.main">
                  Clinical Guidance
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {response}
              </Typography>
            </Paper>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AssessmentGuideBot;