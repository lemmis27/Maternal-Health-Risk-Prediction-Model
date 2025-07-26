import React, { useState } from 'react';
import {
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Paper,
  Avatar,
  IconButton,
  Chip
} from '@mui/material';
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon
} from '@mui/icons-material';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  type?: 'text' | 'suggestion' | 'shap-explanation' | 'ai-response' | 'emergency' | 'development' | 'risk-guidance' | 'general';
}

interface FloatingChatbotProps {
  context?: 'dashboard' | 'assessment' | 'patient-details' | 'shap-analysis';
  contextData?: any;
}

const FloatingChatbot: React.FC<FloatingChatbotProps> = ({ 
  context = 'dashboard', 
  contextData 
}) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: getWelcomeMessage(context),
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');

  function getWelcomeMessage(context: string): string {
    switch (context) {
      case 'assessment':
        return "Hi! I'm here to help explain the risk assessment process and interpret results. What would you like to know?";
      case 'patient-details':
        return "I can help explain patient data, SHAP analysis results, and recommend next steps. How can I assist?";
      case 'shap-analysis':
        return "I'm here to explain the AI risk factors analysis. Ask me about any SHAP values or risk factors you'd like to understand better.";
      default:
        return "Hello! I'm your maternal health AI assistant. I can help explain assessments, interpret risk factors, and guide you through the system.";
    }
  }

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    // Generate intelligent AI response
    setTimeout(async () => {
      const botResponse = await generateIntelligentResponse(inputText, context, contextData);
      setMessages(prev => [...prev, botResponse]);
    }, 1000);
  };

  const generateIntelligentResponse = async (userInput: string, context: string, data: any): Promise<Message> => {
    const input = userInput.toLowerCase();
    
    try {
      // Try OpenAI API first for intelligent responses
      const response = await fetch('/api/chat/general', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          prompt: userInput,
          context: {
            userRole: data?.userRole,
            gestationalAge: data?.gestationalAge,
            riskLevel: data?.riskLevel,
            currentContext: context,
            conversationHistory: messages.slice(-6) // Last 3 exchanges for context
          }
        })
      });
      
      if (response.ok) {
        const aiData = await response.json();
        return {
          id: Date.now().toString(),
          text: aiData.response,
          sender: 'bot',
          timestamp: new Date(),
          type: 'ai-response'
        };
      }
    } catch (error) {
      console.error('AI API error:', error);
    }
    
    // Fallback to intelligent rule-based responses
    return generateSmartFallbackResponse(userInput, context, data);
  };

  const generateSmartFallbackResponse = (userInput: string, context: string, data: any): Message => {
    const input = userInput.toLowerCase();
    const gestationalAge = data?.gestationalAge || 20;
    const riskLevel = data?.riskLevel || 'unknown';
    const userRole = data?.userRole || 'pregnant_mother';
    
    // Emergency detection
    if (input.includes('emergency') || input.includes('bleeding') || input.includes('severe pain') || input.includes('911')) {
      return {
        id: Date.now().toString(),
        text: `🚨 **EMERGENCY GUIDANCE**

If you're experiencing:
• Heavy bleeding
• Severe abdominal pain
• Severe headaches with vision changes
• Signs of preeclampsia
• Decreased fetal movement (after 28 weeks)

**CALL 911 IMMEDIATELY** or go to the nearest emergency room.

For non-emergency urgent concerns, contact your healthcare provider immediately.`,
        sender: 'bot',
        timestamp: new Date(),
        type: 'emergency'
      };
    }

    // Context-aware SHAP explanations
    if (input.includes('shap') || input.includes('risk factor') || input.includes('ai prediction')) {
      const shapText = userRole === 'clinician' 
        ? `**SHAP Analysis for Clinicians:**

SHAP (SHapley Additive exPlanations) provides quantitative feature importance for AI risk predictions:

• **Positive SHAP values** → Factor increases risk
• **Negative SHAP values** → Factor decreases risk  
• **Magnitude** → Strength of influence

**Clinical Application:**
- Use for risk stratification and care planning
- Identify modifiable risk factors for intervention
- Support clinical decision-making with evidence-based insights
- Communicate risk factors to patients effectively

**Integration with Care:**
- Combine with clinical judgment
- Consider patient-specific factors
- Monitor trends over time
- Adjust care plans based on changing risk profiles`
        : `**Understanding AI Risk Predictions:**

Our AI system analyzes your health information to predict pregnancy risks. Here's how it works:

• **Risk Factors**: Things like blood pressure, age, and blood sugar levels
• **Predictions**: The AI combines these factors to estimate your overall risk
• **Explanations**: We show you which factors are most important for your specific situation

**What This Means for You:**
- Higher risk doesn't mean something will definitely happen
- It helps your healthcare team provide better care
- You can work on modifiable factors (like diet and exercise)
- Regular monitoring helps track changes over time

**Remember**: AI predictions support, but never replace, your healthcare provider's clinical judgment.`;

      return {
        id: Date.now().toString(),
        text: shapText,
        sender: 'bot',
        timestamp: new Date(),
        type: 'shap-explanation'
      };
    }

    // Gestational age-specific responses
    if (input.includes('week') || input.includes('trimester') || input.includes('development')) {
      let developmentText = '';
      
      if (gestationalAge <= 12) {
        developmentText = `**First Trimester (Week ${gestationalAge}):**

🌱 **What's Happening:**
• Organ formation is critical
• Morning sickness is common
• Folic acid is essential
• First prenatal visits scheduled

⚠️ **Important:**
• Avoid alcohol and smoking
• Take prenatal vitamins
• Report severe nausea/vomiting
• Schedule first ultrasound`;
      } else if (gestationalAge <= 28) {
        developmentText = `**Second Trimester (Week ${gestationalAge}):**

👶 **Baby Development:**
• Organs are maturing
• Movement becomes noticeable
• Gender may be visible
• Anatomy scan scheduled

📋 **Your Care:**
• Glucose screening (24-28 weeks)
• Anatomy ultrasound (18-22 weeks)
• Feeling more energetic
• Belly growth accelerating`;
      } else {
        developmentText = `**Third Trimester (Week ${gestationalAge}):**

🏃‍♀️ **Final Stretch:**
• Baby is gaining weight rapidly
• Lungs are maturing
• Positioning for birth
• Braxton Hicks contractions

🎯 **Preparation:**
• Birth plan discussions
• Hospital bag preparation
• Weekly appointments
• Watch for labor signs`;
      }
      
      return {
        id: Date.now().toString(),
        text: developmentText,
        sender: 'bot',
        timestamp: new Date(),
        type: 'development'
      };
    }

    // Risk-level specific guidance
    if (input.includes('risk') || input.includes('assessment') || input.includes('level')) {
      const riskGuidance = {
        high: `**High Risk Pregnancy Management:**

🚨 **Immediate Actions:**
• Contact your healthcare provider today
• Schedule frequent monitoring appointments
• Consider specialist consultation
• Monitor symptoms closely

📋 **Enhanced Care Plan:**
• More frequent prenatal visits
• Additional testing and monitoring
• Lifestyle modifications
• Emergency contact information ready

💪 **Stay Positive:**
High risk doesn't mean complications will occur - it means we're watching closely to ensure the best outcomes.`,

        medium: `**Medium Risk Pregnancy Care:**

⚖️ **Balanced Approach:**
• Regular monitoring with some additional precautions
• Follow-up appointments as scheduled
• Be aware of warning signs
• Maintain healthy lifestyle

📅 **Care Schedule:**
• Standard prenatal visits with possible extras
• Targeted screening based on risk factors
• Open communication with healthcare team
• Proactive management of modifiable factors

✅ **Reassurance:**
Medium risk is manageable with proper care and monitoring.`,

        low: `**Low Risk Pregnancy Support:**

✅ **Excellent News:**
• Your current risk level is low
• Continue with routine prenatal care
• Maintain healthy habits
• Stay informed about pregnancy changes

🌟 **Maintain Wellness:**
• Regular prenatal appointments
• Balanced nutrition and exercise
• Adequate rest and stress management
• Stay connected with healthcare team

📚 **Education:**
Even with low risk, staying informed and maintaining good health habits is important for optimal outcomes.`
      };

      return {
        id: Date.now().toString(),
        text: riskGuidance[riskLevel as keyof typeof riskGuidance] || riskGuidance.low,
        sender: 'bot',
        timestamp: new Date(),
        type: 'risk-guidance'
      };
    }

    // Default intelligent response
    const defaultResponses = [
      `I'm here to help with your maternal health questions! I can assist with:

🎓 **Health Education** - Nutrition, exercise, pregnancy stages
📅 **Appointments** - Scheduling guidance and urgency assessment  
💊 **Medications** - Safety during pregnancy and interactions
🧠 **AI Explanations** - Understanding risk predictions and SHAP analysis
🚨 **Emergency Guidance** - When to seek immediate care

What would you like to know about?`,

      `As your AI health assistant, I'm equipped to help with:

• **Pregnancy Questions** - Symptoms, development, care
• **Risk Assessment** - Understanding your health status
• **Clinical Support** - Evidence-based information
• **Emergency Protocols** - When to seek immediate help

Feel free to ask about any aspect of maternal health!`
    ];

    return {
      id: Date.now().toString(),
      text: defaultResponses[Math.floor(Math.random() * defaultResponses.length)],
      sender: 'bot',
      timestamp: new Date(),
      type: 'general'
    };
  };

  const quickSuggestions = [
    "Explain SHAP values",
    "What is high risk?",
    "Blood pressure ranges",
    "How to interpret confidence scores"
  ];

  return (
    <>
      {/* Floating Chat Button */}
      <Fab
        color="primary"
        aria-label="chat"
        sx={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 1000
        }}
        onClick={() => setOpen(true)}
      >
        <ChatIcon />
      </Fab>

      {/* Chat Dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { height: '70vh', display: 'flex', flexDirection: 'column' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BotIcon color="primary" />
          <Typography variant="h6">Maternal Health AI Assistant</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Messages */}
          <Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
            {messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2
                }}
              >
                <Paper
                  sx={{
                    p: 2,
                    maxWidth: '80%',
                    bgcolor: message.sender === 'user' ? 'primary.main' : 'grey.100',
                    color: message.sender === 'user' ? 'white' : 'text.primary'
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Avatar sx={{ width: 24, height: 24 }}>
                      {message.sender === 'user' ? <PersonIcon /> : <BotIcon />}
                    </Avatar>
                    <Typography variant="caption">
                      {message.sender === 'user' ? 'You' : 'AI Assistant'}
                    </Typography>
                  </Box>
                  <Typography variant="body2">{message.text}</Typography>
                  {message.type === 'shap-explanation' && (
                    <Chip
                      label="SHAP Explanation"
                      size="small"
                      color="info"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Paper>
              </Box>
            ))}
          </Box>

          {/* Quick Suggestions */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Quick questions:
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {quickSuggestions.map((suggestion, index) => (
                <Chip
                  key={index}
                  label={suggestion}
                  size="small"
                  onClick={() => setInputText(suggestion)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          {/* Input */}
          <Box display="flex" gap={1}>
            <TextField
              fullWidth
              placeholder="Ask about assessments, SHAP analysis, or health metrics..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              size="small"
            />
            <Button
              variant="contained"
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              <SendIcon />
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FloatingChatbot;