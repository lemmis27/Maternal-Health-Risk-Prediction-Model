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
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  Card,
  CardContent,
  LinearProgress
} from '@mui/material';
import {
  School as EducationIcon,
  Close as CloseIcon,
  Send as SendIcon,
  PregnantWoman,
  Restaurant,
  FitnessCenter,
  Warning,
  ChildCare as Baby,
  Favorite,
  Psychology
} from '@mui/icons-material';

interface HealthEducationBotProps {
  gestationalAge?: number;
  riskLevel?: string;
  userRole?: string;
}

const HealthEducationBot: React.FC<HealthEducationBotProps> = ({
  gestationalAge = 20,
  riskLevel = 'low',
  userRole = 'pregnant_mother'
}) => {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const callOpenAI = async (prompt: string, context: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/chat/health-education', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          prompt: `${context}: ${prompt}`,
          context: {
            gestationalAge,
            riskLevel,
            userRole,
            category: context
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }
      
      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('OpenAI API error:', error);
      return generateFallbackResponse(prompt, context);
    } finally {
      setLoading(false);
    }
  };

  const generateFallbackResponse = (userQuestion: string, context: string) => {
    const q = userQuestion.toLowerCase();
    const week = gestationalAge;
    
    if (context === 'nutrition' || q.includes('food') || q.includes('eat')) {
      return `**Nutrition During Pregnancy (Week ${week}):**

🥗 **Essential Foods:**
• Leafy greens (folate, iron)
• Lean proteins (baby's growth)
• Dairy products (calcium for bones)
• Whole grains (energy, fiber)
• Colorful fruits (vitamins, antioxidants)

⚠️ **Foods to Avoid:**
• Raw fish, undercooked meat
• Unpasteurized dairy products
• High-mercury fish (shark, swordfish)
• Excessive caffeine (limit to 200mg/day)
• Alcohol (completely avoid)

💊 **Supplements:**
• Prenatal vitamins daily
• Folic acid (400-800 mcg)
• Iron (if recommended by doctor)
• Calcium (1000mg daily)

${riskLevel === 'high' ? '⚠️ **High Risk Note:** Consult your doctor about specific dietary restrictions.' : ''}`;
    }

    if (context === 'exercise' || q.includes('exercise') || q.includes('fitness')) {
      return `**Safe Exercise During Pregnancy (Week ${week}):**

✅ **Recommended Activities:**
• Walking (30 minutes daily)
• Swimming (low impact, full body)
• Prenatal yoga (flexibility, relaxation)
• Stationary cycling (avoid outdoor cycling later)
• Light strength training (with modifications)

⚠️ **Avoid These Activities:**
• Contact sports (soccer, basketball)
• High-altitude activities
• Scuba diving
• Hot yoga or saunas
• Exercises lying flat on back (after 20 weeks)

🎯 **Guidelines:**
• Stay hydrated
• Don't overheat
• Listen to your body
• Stop if you feel dizzy or short of breath

${riskLevel === 'high' ? '⚠️ **High Risk Note:** Get doctor approval before starting any exercise program.' : ''}`;
    }

    if (context === 'development' || q.includes('baby') || q.includes('development')) {
      const developmentInfo: Record<number, string> = {
        12: "Baby is size of a plum. Organs are forming, heartbeat detectable.",
        16: "Baby is size of an avocado. Gender may be visible on ultrasound.",
        20: "Baby is size of a banana. Halfway point! Anatomy scan time.",
        24: "Baby is size of an ear of corn. Hearing is developing.",
        28: "Baby is size of an eggplant. Eyes can open and close.",
        32: "Baby is size of a squash. Bones are hardening.",
        36: "Baby is size of a papaya. Lungs are maturing.",
        40: "Baby is full-term! Ready for birth."
      };
      
      const nearestWeek = Object.keys(developmentInfo).reduce((prev, curr) => 
        Math.abs(parseInt(curr) - week) < Math.abs(parseInt(prev) - week) ? curr : prev
      );
      
      return `**Baby Development (Week ${week}):**

👶 **Current Stage:**
${developmentInfo[parseInt(nearestWeek)]}

🧠 **What's Happening:**
• Brain development is rapid
• Movements becoming stronger
• Senses are developing
• Growth is accelerating

👩‍⚕️ **What You Might Feel:**
• Increased fetal movement
• Growing belly
• Possible back pain
• Braxton Hicks contractions (practice contractions)

📅 **Upcoming Milestones:**
• Regular prenatal checkups
• Ultrasound appointments
• Glucose screening (24-28 weeks)
• Group B strep test (35-37 weeks)`;
    }

    if (context === 'symptoms' || q.includes('symptom') || q.includes('feel')) {
      return `**Common Pregnancy Symptoms (Week ${week}):**

😴 **Normal Symptoms:**
• Fatigue and tiredness
• Nausea (especially first trimester)
• Breast tenderness
• Frequent urination
• Mood changes
• Back pain
• Heartburn

🚨 **When to Call Doctor:**
• Severe headaches
• Vision changes
• Severe abdominal pain
• Heavy bleeding
• Persistent vomiting
• Signs of preeclampsia
• Decreased fetal movement (after 28 weeks)

💡 **Management Tips:**
• Rest when tired
• Eat small, frequent meals
• Stay hydrated
• Gentle exercise
• Prenatal massage
• Support belt for back pain

${riskLevel === 'high' ? '⚠️ **High Risk:** Monitor symptoms closely and report any changes immediately.' : ''}`;
    }

    return `I can help with pregnancy education on:
• Nutrition and healthy eating
• Safe exercise and fitness
• Baby development stages
• Common symptoms and management
• Prenatal care guidelines

Ask me about any aspect of pregnancy health!`;
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    
    const tabContexts = ['general', 'nutrition', 'exercise', 'development', 'symptoms'];
    const context = tabContexts[activeTab];
    
    const aiResponse = await callOpenAI(question, context);
    setResponse(aiResponse);
    setQuestion('');
  };

  const educationTopics = [
    {
      icon: <PregnantWoman />,
      title: "General Health",
      topics: ["Prenatal care", "Weight gain", "Sleep", "Stress management"]
    },
    {
      icon: <Restaurant />,
      title: "Nutrition",
      topics: ["Healthy foods", "Supplements", "Foods to avoid", "Meal planning"]
    },
    {
      icon: <FitnessCenter />,
      title: "Exercise",
      topics: ["Safe workouts", "Yoga", "Walking", "Strength training"]
    },
    {
      icon: <Baby />,
      title: "Baby Development",
      topics: ["Growth milestones", "Fetal movement", "Ultrasounds", "Birth preparation"]
    },
    {
      icon: <Warning />,
      title: "Symptoms",
      topics: ["Normal symptoms", "Warning signs", "Pain management", "When to call doctor"]
    }
  ];

  return (
    <>
      <Button
        variant="contained"
        startIcon={<EducationIcon />}
        onClick={() => setOpen(true)}
        color="info"
        sx={{ mb: 2 }}
      >
        Health Education
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EducationIcon color="info" />
          Pregnancy Health Education Assistant
          <Box sx={{ flexGrow: 1 }} />
          <Chip 
            label={`Week ${gestationalAge}`} 
            color="primary" 
            size="small" 
          />
          <Chip 
            label={`${riskLevel.toUpperCase()} Risk`} 
            color={riskLevel === 'high' ? 'error' : riskLevel === 'medium' ? 'warning' : 'success'} 
            size="small" 
          />
          <IconButton onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Get personalized health education based on your pregnancy stage and risk level. 
              Information is tailored to week {gestationalAge} of pregnancy.
            </Typography>
          </Alert>

          {/* Topic Tabs */}
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
            {educationTopics.map((topic, index) => (
              <Tab key={index} icon={topic.icon} label={topic.title} />
            ))}
          </Tabs>

          {/* Topic Cards */}
          <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={2} mb={2}>
            {educationTopics[activeTab].topics.map((topic, index) => (
              <Card 
                key={index} 
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}
                onClick={() => setQuestion(`Tell me about ${topic} during pregnancy`)}
              >
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="body2" textAlign="center">
                    {topic}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Question Input */}
          <Box display="flex" gap={1} mb={2}>
            <TextField
              fullWidth
              placeholder={`Ask about ${educationTopics[activeTab].title.toLowerCase()} during pregnancy...`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
              disabled={loading}
            />
            <Button
              variant="contained"
              onClick={handleAskQuestion}
              disabled={!question.trim() || loading}
              color="info"
            >
              <SendIcon />
            </Button>
          </Box>

          {loading && <LinearProgress sx={{ mb: 2 }} />}

          {/* AI Response */}
          {response && (
            <Paper sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Psychology color="info" />
                <Typography variant="subtitle2" color="info.main">
                  AI Health Educator
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

export default HealthEducationBot;