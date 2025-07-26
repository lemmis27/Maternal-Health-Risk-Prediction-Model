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
  Alert
} from '@mui/material';
import {
  Psychology as AIIcon,
  Close as CloseIcon,
  Send as SendIcon,
  Lightbulb as InsightIcon
} from '@mui/icons-material';

interface ShapExplainerBotProps {
  shapData: any[];
  assessmentData: any;
  riskLevel: string;
}

const ShapExplainerBot: React.FC<ShapExplainerBotProps> = ({
  shapData,
  assessmentData,
  riskLevel
}) => {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [explanation, setExplanation] = useState('');

  const generateClinicalShapPrompt = (userQuestion: string) => {
    // Get top 3 factors by absolute SHAP value
    const topFactors = shapData
      .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
      .slice(0, 3);

    // Extract patient context
    const age = assessmentData?.age || 'unknown';
    const gestationalAge = assessmentData?.gestational_age || 'unknown';
    const keyValues = topFactors.map(f => `${f.feature}: ${f.value}`).join(', ');

    return `**Role**: You are an AI clinical assistant specialized in maternal-fetal medicine. Your explanations must align with WHO, ACOG, and NICE guidelines.

**Task**: Explain the clinical significance of the top 3 prediction factors identified by SHAP analysis for a maternal risk level of \`${riskLevel.toUpperCase()}\`.

**Patient Context** (de-identified):
- Age: \`${age}\`
- Gestational Age: \`${gestationalAge} weeks\`
- Relevant Vitals/Labs: \`${keyValues}\`

**Top Factors & SHAP Values**:
${topFactors.map((factor, index) =>
      `${index + 1}. \`${factor.feature}\` (SHAP: \`${factor.shap_value.toFixed(3)}\`)`
    ).join('\n')}

**User Question**: ${userQuestion}

**Output Requirements**:
1. For EACH factor:
   - **Mechanism**: Explain the pathophysiological link to maternal risk in ≤2 sentences
   - **Threshold**: Reference clinical guidelines (e.g., "ACOG defines hypertension as >140/90 mmHg")
   - **Impact Magnitude**: Relate SHAP value to clinical severity
   - **Actionability**: Suggest evidence-based clinical actions

2. **Synthesis**: Explain interaction between factors in ≤3 sentences

3. **Constraints**:
   - Cite ONLY from: WHO Maternal Health Guidelines, ACOG Practice Bulletins (2020-2023), or Cochrane Pregnancy Reviews
   - If no guideline exists, state: "No established threshold - clinical correlation needed"
   - Never invent numerical thresholds
   - Flag conflicting evidence where applicable

**Focus on the user's specific question while providing comprehensive clinical context.**`;
  };

  const generateFallbackExplanation = (userQuestion: string) => {
    const q = userQuestion.toLowerCase();

    if (q.includes('systolic') || q.includes('blood pressure')) {
      const systolicFactor = shapData.find(f => f.feature.toLowerCase().includes('systolic'));
      if (systolicFactor) {
        return `**Clinical Analysis: Systolic Blood Pressure**

**Value**: ${systolicFactor.value} mmHg (SHAP: ${systolicFactor.shap_value.toFixed(3)})

**Clinical Mechanism**: 
Elevated systolic BP during pregnancy indicates increased vascular resistance and potential endothelial dysfunction. This can progress to preeclampsia, affecting maternal and fetal outcomes through placental hypoperfusion.

**Guideline Reference**: 
ACOG defines gestational hypertension as systolic BP ≥140 mmHg on two occasions ≥4 hours apart. WHO guidelines classify severe hypertension as ≥160 mmHg systolic.

**Risk Interpretation**: 
${systolicFactor.impact === 'positive'
            ? `SHAP value of ${systolicFactor.shap_value.toFixed(3)} indicates this measurement significantly increases preeclampsia risk. Values >140 mmHg warrant immediate evaluation.`
            : `SHAP value of ${systolicFactor.shap_value.toFixed(3)} indicates this measurement reduces overall risk. Current value is within normal pregnancy range.`
          }

**Clinical Action**: 
${systolicFactor.value > 140
            ? 'Immediate: Repeat BP measurement, assess for preeclampsia symptoms, consider antihypertensive therapy per ACOG guidelines.'
            : 'Continue routine monitoring. Next BP check at scheduled prenatal visit unless symptoms develop.'
          }`;
      }
    }

    if (q.includes('age')) {
      const ageFactor = shapData.find(f => f.feature.toLowerCase().includes('age'));
      if (ageFactor) {
        return `**Clinical Analysis: Maternal Age**

**Value**: ${ageFactor.value} years (SHAP: ${ageFactor.shap_value.toFixed(3)})

**Clinical Mechanism**: 
${ageFactor.value >= 35
            ? 'Advanced maternal age (≥35) increases risk through chromosomal abnormalities, chronic medical conditions, and decreased ovarian reserve affecting placental development.'
            : ageFactor.value < 18
              ? 'Adolescent pregnancy increases risk due to incomplete physical development, nutritional competition, and psychosocial factors affecting prenatal care compliance.'
              : 'Optimal reproductive age with lowest baseline risk for maternal and fetal complications.'
          }

**Guideline Reference**: 
ACOG defines advanced maternal age as ≥35 years at delivery. WHO identifies adolescent pregnancy (<18 years) as high-risk requiring specialized care.

**Risk Interpretation**: 
SHAP value of ${ageFactor.shap_value.toFixed(3)} ${ageFactor.impact === 'positive' ? 'increases' : 'decreases'} overall risk prediction based on age-related physiological factors.

**Clinical Action**: 
${ageFactor.value >= 35
            ? 'Offer genetic counseling, enhanced fetal surveillance, and screening for gestational diabetes and hypertensive disorders.'
            : ageFactor.value < 18
              ? 'Provide comprehensive prenatal care with nutritional counseling, psychosocial support, and frequent monitoring.'
              : 'Continue standard prenatal care with routine risk-based screening.'
          }`;
      }
    }

    if (q.includes('blood sugar') || q.includes('glucose')) {
      const sugarFactor = shapData.find(f => f.feature.toLowerCase().includes('sugar') || f.feature.toLowerCase().includes('bs'));
      if (sugarFactor) {
        return `**Clinical Analysis: Blood Glucose**

**Value**: ${sugarFactor.value} mmol/L (SHAP: ${sugarFactor.shap_value.toFixed(3)})

**Clinical Mechanism**: 
Hyperglycemia during pregnancy causes fetal hyperinsulinemia, leading to macrosomia, polyhydramnios, and increased risk of shoulder dystocia. Maternal complications include preeclampsia and cesarean delivery.

**Guideline Reference**: 
WHO/IADPSG criteria for gestational diabetes: Fasting glucose ≥5.1 mmol/L, 1-hour OGTT ≥10.0 mmol/L, or 2-hour OGTT ≥8.5 mmol/L.

**Risk Interpretation**: 
${sugarFactor.impact === 'positive'
            ? `SHAP value of ${sugarFactor.shap_value.toFixed(3)} indicates significant contribution to increased risk. Current value suggests possible gestational diabetes.`
            : `SHAP value of ${sugarFactor.shap_value.toFixed(3)} indicates this measurement reduces overall risk. Glucose level within normal pregnancy range.`
          }

**Clinical Action**: 
${sugarFactor.value > 7.8
            ? 'Immediate: Confirm with formal OGTT, initiate dietary counseling, consider endocrine consultation per ACOG guidelines.'
            : 'Continue routine GDM screening at 24-28 weeks unless risk factors warrant earlier testing.'
          }`;
      }
    }

    if (q.includes('overall') || q.includes('summary') || q.includes('comprehensive')) {
      const topFactors = shapData.sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value)).slice(0, 3);

      return `**Comprehensive SHAP Analysis: ${riskLevel.toUpperCase()} Risk**

**Top Contributing Factors**:
${topFactors.map((factor, index) =>
        `${index + 1}. **${factor.feature}**: ${factor.value} (SHAP: ${factor.shap_value.toFixed(3)}) - ${factor.impact === 'positive' ? 'INCREASES' : 'DECREASES'} risk`
      ).join('\n')}

**Factor Interactions**:
The combination of these factors creates a ${riskLevel} risk profile through synergistic pathophysiological mechanisms. ${riskLevel === 'high'
          ? 'Multiple positive SHAP values indicate convergent risk pathways requiring immediate clinical intervention.'
          : riskLevel === 'medium'
            ? 'Mixed SHAP values suggest balanced risk factors requiring enhanced monitoring and preventive measures.'
            : 'Predominantly negative SHAP values indicate protective factors supporting continued routine care.'
        }

**Evidence-Based Management**:
${riskLevel === 'high'
          ? '• Immediate obstetric consultation\n• Enhanced fetal surveillance (NST/BPP)\n• Consider delivery planning\n• Multidisciplinary team involvement'
          : riskLevel === 'medium'
            ? '• Increased prenatal visit frequency\n• Serial growth assessments\n• Targeted interventions for modifiable factors\n• Patient education on warning signs'
            : '• Continue routine prenatal care\n• Standard screening protocols\n• Lifestyle counseling for optimal outcomes\n• Reassurance with continued monitoring'
        }

**Clinical Correlation**: 
SHAP analysis provides quantitative risk stratification, but clinical judgment remains paramount. Consider patient-specific factors, social determinants, and evolving clinical picture in management decisions.`;
    }

    return `**SHAP Clinical Assistant Ready**

I can provide evidence-based explanations for:
• **Individual Risk Factors**: Systolic BP, age, blood glucose, heart rate
• **Clinical Mechanisms**: Pathophysiology linking factors to maternal risk
• **Guideline References**: WHO, ACOG, NICE recommendations
• **Management Actions**: Evidence-based clinical interventions
• **Comprehensive Analysis**: Factor interactions and overall risk interpretation

**Ask me about**: "systolic blood pressure significance", "age-related risks", "glucose impact", "overall risk analysis", or any specific SHAP factor.`;
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;

    try {
      // Try OpenAI API first
      const response = await fetch('/api/chat/shap-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          prompt: generateClinicalShapPrompt(question),
          context: {
            shapData,
            assessmentData,
            riskLevel
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        setExplanation(data.response);
      } else {
        throw new Error('OpenAI API failed');
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
      // Use fallback explanation
      const fallbackResponse = generateFallbackExplanation(question);
      setExplanation(fallbackResponse);
    }

    setQuestion('');
  };

  const quickQuestions = [
    "Why is systolic BP important?",
    "How does age affect risk?",
    "What's normal blood sugar?",
    "Explain overall risk"
  ];

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<AIIcon />}
        onClick={() => setOpen(true)}
        size="small"
        sx={{ mt: 1 }}
      >
        Ask AI to Explain
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AIIcon color="primary" />
          SHAP Analysis Explainer
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Ask me about specific SHAP values, risk factors, or what the overall assessment means for patient care.
            </Typography>
          </Alert>

          {/* Current SHAP Summary */}
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" gutterBottom>
              Current Assessment: {riskLevel.toUpperCase()} Risk
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {shapData.slice(0, 3).map((factor, index) => (
                <Chip
                  key={index}
                  label={`${factor.feature}: ${factor.shap_value.toFixed(3)}`}
                  color={factor.impact === 'positive' ? 'error' : 'success'}
                  size="small"
                />
              ))}
            </Box>
          </Paper>

          {/* Quick Questions */}
          <Typography variant="subtitle2" gutterBottom>
            Quick Questions:
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
            {quickQuestions.map((q, index) => (
              <Chip
                key={index}
                label={q}
                onClick={() => setQuestion(q)}
                sx={{ cursor: 'pointer' }}
                variant="outlined"
              />
            ))}
          </Box>

          {/* Question Input */}
          <Box display="flex" gap={1} mb={2}>
            <TextField
              fullWidth
              placeholder="Ask about specific SHAP values or risk factors..."
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

          {/* AI Explanation */}
          {explanation && (
            <Paper sx={{ p: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <InsightIcon color="primary" />
                <Typography variant="subtitle2" color="primary">
                  AI Explanation
                </Typography>
              </Box>
              <Typography variant="body2">
                {explanation}
              </Typography>
            </Paper>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ShapExplainerBot;