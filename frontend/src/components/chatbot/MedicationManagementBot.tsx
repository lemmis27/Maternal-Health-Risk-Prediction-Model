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
  Card,
  CardContent,
  Tabs,
  Tab,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Medication as MedicationIcon,
  Close as CloseIcon,
  Send as SendIcon,
  Warning,
  CheckCircle,
  Info,
  Schedule,
  Psychology,
  Healing,
  LocalPharmacy,
  ReportProblem
} from '@mui/icons-material';

interface MedicationManagementBotProps {
  currentMedications?: any[];
  gestationalAge?: number;
  riskLevel?: string;
  allergies?: string[];
}

const MedicationManagementBot: React.FC<MedicationManagementBotProps> = ({
  currentMedications = [],
  gestationalAge = 20,
  riskLevel = 'low',
  allergies = []
}) => {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const callOpenAI = async (prompt: string, context: string) => {
    setLoading(true);
    try {
      // This will be replaced with actual OpenAI API call
      const response = await fetch('/api/chat/medication-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          prompt,
          context: {
            currentMedications,
            gestationalAge,
            riskLevel,
            allergies,
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
    const trimester = gestationalAge <= 12 ? 1 : gestationalAge <= 28 ? 2 : 3;
    
    if (context === 'safety' || q.includes('safe') || q.includes('pregnancy')) {
      return `**Medication Safety During Pregnancy (Week ${gestationalAge}):**

✅ **Generally Safe:**
• Prenatal vitamins (essential)
• Folic acid (400-800 mcg daily)
• Iron supplements (if prescribed)
• Acetaminophen/Tylenol (for pain/fever)
• Some antibiotics (amoxicillin, penicillin)
• Insulin (for diabetes)

⚠️ **Use with Caution:**
• Antihistamines (Benadryl, Claritin)
• Some antacids (avoid high sodium)
• Topical medications (limited absorption)
• Certain antidepressants (consult doctor)

❌ **Avoid During Pregnancy:**
• Ibuprofen/NSAIDs (especially 3rd trimester)
• Aspirin (except low-dose if prescribed)
• ACE inhibitors (blood pressure)
• Warfarin (blood thinner)
• Isotretinoin (acne medication)
• Most herbal supplements

**Trimester ${trimester} Considerations:**
${trimester === 1 ? '• Critical organ development period\n• Avoid all unnecessary medications' : 
  trimester === 2 ? '• Safest period for necessary medications\n• Good time for dental work if needed' :
  '• Some medications become riskier\n• Prepare for breastfeeding considerations'}

⚠️ **Always consult your healthcare provider before starting, stopping, or changing any medication.**`;
    }

    if (context === 'interactions' || q.includes('interaction') || q.includes('together')) {
      return `**Drug Interactions During Pregnancy:**

🔍 **Common Interactions to Watch:**

**Iron + Calcium:**
• Take 2 hours apart for better absorption
• Coffee/tea can reduce iron absorption

**Prenatal Vitamins + Other Supplements:**
• Don't double up on vitamins
• Check total vitamin A intake (<10,000 IU)
• Avoid extra vitamin D without testing

**Prescription + Over-the-Counter:**
• Always tell doctors about ALL medications
• Include vitamins, supplements, herbal products
• Some combinations can be dangerous

**Food + Medication Interactions:**
• Calcium-rich foods can block iron absorption
• Grapefruit can affect some medications
• High-fiber foods may reduce drug absorption

${currentMedications.length > 0 ? `**Your Current Medications:**
${currentMedications.map(med => `• ${med.medication_name} - Check with pharmacist for interactions`).join('\n')}` : ''}

${allergies.length > 0 ? `**Your Allergies:**
${allergies.map(allergy => `• ${allergy} - Avoid related medications`).join('\n')}` : ''}

**Safety Tips:**
• Use one pharmacy for all prescriptions
• Keep updated medication list
• Ask pharmacist about interactions
• Never stop prescribed medications without consulting doctor`;
    }

    if (context === 'prenatal' || q.includes('vitamin') || q.includes('prenatal')) {
      return `**Prenatal Vitamins & Supplements (Week ${gestationalAge}):**

💊 **Essential Prenatal Vitamins:**
• **Folic Acid:** 400-800 mcg (prevents birth defects)
• **Iron:** 27 mg (prevents anemia)
• **Calcium:** 1000 mg (bone development)
• **Vitamin D:** 600 IU (bone health)
• **DHA:** 200-300 mg (brain development)
• **Vitamin B12:** 2.6 mcg (nervous system)

⏰ **When to Take:**
• Morning: Prenatal vitamin (with food to reduce nausea)
• Evening: Iron supplement (better absorption)
• With meals: Calcium (improves absorption)
• Separate: Iron and calcium by 2 hours

🤢 **If Vitamins Cause Nausea:**
• Take with food or before bed
• Try gummy vitamins (but check iron content)
• Split dose throughout day
• Switch brands if needed

**Trimester-Specific Needs:**
${trimester === 1 ? '• Focus on folic acid (neural tube development)\n• Combat nausea with B6 if recommended' :
  trimester === 2 ? '• Continue all prenatal vitamins\n• May need additional iron if anemic' :
  '• Maintain all supplements\n• Prepare for breastfeeding nutrition needs'}

⚠️ **Avoid These Supplements:**
• Vitamin A >10,000 IU (birth defects)
• High-dose vitamin C (>2000 mg)
• Herbal supplements (safety unknown)
• Weight loss supplements

**Quality Tips:**
• Choose reputable brands
• Look for USP verification
• Check expiration dates
• Store in cool, dry place`;
    }

    if (context === 'side-effects' || q.includes('side effect') || q.includes('reaction')) {
      return `**Managing Medication Side Effects:**

🤢 **Common Side Effects & Solutions:**

**Nausea from Vitamins:**
• Take with food or before bed
• Try gummy or liquid forms
• Split doses throughout day
• Switch to different brand

**Constipation from Iron:**
• Increase fiber intake
• Drink more water
• Take with vitamin C
• Consider stool softener (if approved)

**Heartburn from Medications:**
• Take with food
• Avoid lying down after taking
• Use approved antacids
• Smaller, more frequent doses

**Drowsiness:**
• Take at bedtime if possible
• Avoid driving until adjusted
• Check with doctor about timing
• May improve with time

🚨 **Serious Side Effects - Call Doctor:**
• Severe allergic reactions (rash, swelling)
• Difficulty breathing
• Severe nausea/vomiting
• Unusual bleeding
• Severe headaches
• Vision changes

**Reporting Side Effects:**
• Keep symptom diary
• Note timing with medication
• Report to healthcare provider
• Don't stop medications abruptly

**Prevention Tips:**
• Start new medications one at a time
• Read all labels carefully
• Follow dosing instructions exactly
• Keep emergency contacts handy

${riskLevel === 'high' ? '⚠️ **High Risk:** Report any side effects immediately to your healthcare team.' : ''}`;
    }

    return `I can help you with:

💊 **Medication Safety** - What's safe during pregnancy
🔄 **Drug Interactions** - How medications work together  
🌟 **Prenatal Vitamins** - Essential supplements and timing
⚠️ **Side Effects** - Managing and reporting reactions

Ask me about specific medications, vitamins, or concerns!`;
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    
    const tabContexts = ['safety', 'interactions', 'prenatal', 'side-effects'];
    const context = tabContexts[activeTab];
    
    const aiResponse = await callOpenAI(question, context);
    setResponse(aiResponse);
    setQuestion('');
  };

  const medicationCategories = [
    {
      icon: <Healing />,
      title: "Safety",
      topics: ["Safe medications", "Avoid during pregnancy", "Trimester guidelines", "Emergency medications"]
    },
    {
      icon: <ReportProblem />,
      title: "Interactions",
      topics: ["Drug combinations", "Food interactions", "Supplement conflicts", "Timing guidelines"]
    },
    {
      icon: <LocalPharmacy />,
      title: "Prenatal Vitamins",
      topics: ["Essential vitamins", "Dosing schedule", "Best absorption", "Quality brands"]
    },
    {
      icon: <Warning />,
      title: "Side Effects",
      topics: ["Common reactions", "Managing nausea", "When to call doctor", "Reporting systems"]
    }
  ];

  const commonMedications = [
    { name: "Acetaminophen", safety: "Safe", notes: "Preferred pain reliever" },
    { name: "Ibuprofen", safety: "Avoid", notes: "Especially 3rd trimester" },
    { name: "Prenatal Vitamins", safety: "Essential", notes: "Take daily with food" },
    { name: "Iron Supplements", safety: "Safe", notes: "May cause constipation" },
    { name: "Antacids", safety: "Most Safe", notes: "Avoid high sodium types" }
  ];

  return (
    <>
      <Button
        variant="contained"
        startIcon={<MedicationIcon />}
        onClick={() => setOpen(true)}
        color="secondary"
        sx={{ mb: 2 }}
      >
        Medication Guide
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MedicationIcon color="secondary" />
          Medication Management Assistant
          <Box sx={{ flexGrow: 1 }} />
          <Chip 
            label={`Week ${gestationalAge}`} 
            color="primary" 
            size="small" 
          />
          <Chip 
            label={`Trimester ${gestationalAge <= 12 ? 1 : gestationalAge <= 28 ? 2 : 3}`} 
            color="info" 
            size="small" 
          />
          <IconButton onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Important:</strong> Always consult your healthcare provider before starting, stopping, 
              or changing any medication during pregnancy. This information is for educational purposes only.
            </Typography>
          </Alert>

          {/* Current Medications */}
          {currentMedications.length > 0 && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'info.50' }}>
              <Typography variant="subtitle2" gutterBottom>
                Your Current Medications:
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {currentMedications.map((med, index) => (
                  <Chip
                    key={index}
                    label={med.medication_name}
                    color="info"
                    size="small"
                  />
                ))}
              </Box>
            </Paper>
          )}

          {/* Category Tabs */}
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
            {medicationCategories.map((category, index) => (
              <Tab key={index} icon={category.icon} label={category.title} />
            ))}
          </Tabs>

          {/* Quick Reference Table */}
          <Typography variant="subtitle2" gutterBottom>
            Quick Safety Reference:
          </Typography>
          <TableContainer component={Paper} sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Medication</TableCell>
                  <TableCell>Safety</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {commonMedications.map((med, index) => (
                  <TableRow key={index}>
                    <TableCell>{med.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={med.safety}
                        color={med.safety === 'Safe' || med.safety === 'Essential' ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{med.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Topic Cards */}
          <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={2} mb={2}>
            {medicationCategories[activeTab].topics.map((topic, index) => (
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
              placeholder={`Ask about ${medicationCategories[activeTab].title.toLowerCase()} during pregnancy...`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
              disabled={loading}
              multiline
              rows={2}
            />
            <Button
              variant="contained"
              onClick={handleAskQuestion}
              disabled={!question.trim() || loading}
              color="secondary"
              sx={{ alignSelf: 'flex-start' }}
            >
              <SendIcon />
            </Button>
          </Box>

          {loading && <LinearProgress sx={{ mb: 2 }} />}

          {/* AI Response */}
          {response && (
            <Paper sx={{ p: 2, bgcolor: 'secondary.50', border: '1px solid', borderColor: 'secondary.200' }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Psychology color="secondary" />
                <Typography variant="subtitle2" color="secondary.main">
                  Medication Assistant
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {response}
              </Typography>
            </Paper>
          )}

          {/* Emergency Contact */}
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Poison Control:</strong> 1-800-222-1222 | 
              <strong> Emergency:</strong> 911 | 
              <strong> Your Doctor:</strong> Contact immediately for medication emergencies
            </Typography>
          </Alert>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MedicationManagementBot;