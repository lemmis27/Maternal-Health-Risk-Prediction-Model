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
    ListItemText,
    Card,
    CardContent,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    LinearProgress,
    Stepper,
    Step,
    StepLabel
} from '@mui/material';
import {
    Schedule as ScheduleIcon,
    Close as CloseIcon,
    Send as SendIcon,
    CalendarToday,
    AccessTime,
    Person,
    Warning,
    CheckCircle,
    Psychology
} from '@mui/icons-material';

interface AppointmentSchedulingBotProps {
    motherId?: string;
    riskLevel?: string;
    lastAssessmentDate?: string;
    nextAppointment?: any;
}

const AppointmentSchedulingBot: React.FC<AppointmentSchedulingBotProps> = ({
    motherId,
    riskLevel = 'low',
    lastAssessmentDate,
    nextAppointment
}) => {
    const [open, setOpen] = useState(false);
    const [question, setQuestion] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const [appointmentData, setAppointmentData] = useState({
        urgency: '',
        symptoms: '',
        preferredDate: '',
        preferredTime: '',
        reason: ''
    });

    const callOpenAI = async (prompt: string, context: any) => {
        setLoading(true);
        try {
            // This will be replaced with actual OpenAI API call
            const response = await fetch('/api/chat/appointment-scheduling', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify({
                    prompt,
                    context: {
                        motherId,
                        riskLevel,
                        lastAssessmentDate,
                        nextAppointment,
                        appointmentData
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

    const generateFallbackResponse = (userQuestion: string, context: any) => {
        const q = userQuestion.toLowerCase();
        const daysSinceAssessment = lastAssessmentDate ?
            Math.floor((new Date().getTime() - new Date(lastAssessmentDate).getTime()) / (1000 * 60 * 60 * 24)) :
            null;

        if (q.includes('urgent') || q.includes('emergency') || q.includes('pain')) {
            return `🚨 **Urgent Appointment Needed**

Based on your symptoms, you should:

**Immediate (Call Now):**
• Severe headaches with vision changes
• Heavy bleeding
• Severe abdominal pain
• Signs of preeclampsia
• Decreased fetal movement (after 28 weeks)

**Same Day:**
• Persistent vomiting
• High fever (>100.4°F)
• Severe back pain
• Unusual discharge

**Within 24-48 Hours:**
• Mild to moderate symptoms
• Routine concerns
• Follow-up questions

${riskLevel === 'high' ? '⚠️ **High Risk Patient:** Any new symptoms should be evaluated promptly.' : ''}

**Next Steps:**
1. Call your healthcare provider immediately if urgent
2. Use patient portal for non-urgent scheduling
3. Visit emergency room if life-threatening`;
        }

        if (q.includes('routine') || q.includes('checkup') || q.includes('regular')) {
            return `📅 **Routine Appointment Scheduling**

**Recommended Schedule:**
• **First Trimester:** Every 4 weeks (weeks 4-28)
• **Second Trimester:** Every 2-3 weeks (weeks 28-36)
• **Third Trimester:** Weekly (weeks 36-40)

${daysSinceAssessment ? `**Your Status:** Last assessment was ${daysSinceAssessment} days ago.` : ''}

**Typical Routine Visits Include:**
• Weight and blood pressure check
• Urine test
• Fetal heart rate monitoring
• Fundal height measurement
• Discussion of symptoms/concerns

**Best Times to Schedule:**
• Morning appointments (less waiting)
• Mid-week (Tuesday-Thursday)
• Allow 30-60 minutes for visit

${riskLevel === 'high' ? '⚠️ **High Risk:** May need more frequent visits as recommended by your doctor.' : ''}`;
        }

        if (q.includes('reschedule') || q.includes('cancel') || q.includes('change')) {
            return `🔄 **Rescheduling Appointments**

**How to Reschedule:**
1. Call clinic at least 24 hours in advance
2. Use patient portal online
3. Explain reason for change

**Valid Reasons:**
• Illness (yours or family)
• Work conflicts
• Transportation issues
• Weather conditions

**Important Notes:**
• Some appointments are time-sensitive
• Lab work may need to be rescheduled too
• Ultrasounds have optimal timing windows

${nextAppointment ? `**Your Next Appointment:** ${new Date(nextAppointment.appointment_date).toLocaleDateString()}` : ''}

**Rescheduling Tips:**
• Offer multiple alternative dates
• Consider morning vs. afternoon preferences
• Ask about cancellation list for earlier slots`;
        }

        if (q.includes('prepare') || q.includes('what to bring') || q.includes('before')) {
            return `📋 **Appointment Preparation**

**What to Bring:**
• Insurance card and ID
• List of current medications
• Previous test results
• Questions written down
• Support person (if desired)

**Before Your Visit:**
• Arrive 15 minutes early
• Use bathroom (may need urine sample)
• Wear comfortable, loose clothing
• Avoid heavy meals if blood work needed

**Questions to Prepare:**
• Any new symptoms or concerns
• Medication questions
• Birth plan discussions
• Lifestyle questions (exercise, travel)

**Special Preparations:**
• Glucose test: Follow fasting instructions
• Ultrasound: May need full bladder
• Group B strep: No special preparation needed

**After Appointment:**
• Schedule next visit before leaving
• Pick up any prescriptions
• Follow up on test results as instructed`;
        }

        return `I can help you with:

🚨 **Urgent Scheduling** - When you need immediate care
📅 **Routine Appointments** - Regular prenatal visits
🔄 **Rescheduling** - Changing existing appointments
📋 **Preparation** - What to expect and bring

Ask me about appointment timing, urgency levels, or what to expect!`;
    };

    const handleAskQuestion = async () => {
        if (!question.trim()) return;

        const aiResponse = await callOpenAI(question, appointmentData);
        setResponse(aiResponse);
        setQuestion('');
    };

    const urgencyLevels = [
        { level: 'emergency', color: 'error', icon: <Warning />, label: 'Emergency (Call 911)' },
        { level: 'urgent', color: 'error', icon: <Warning />, label: 'Urgent (Same Day)' },
        { level: 'soon', color: 'warning', icon: <AccessTime />, label: 'Soon (Within Week)' },
        { level: 'routine', color: 'success', icon: <CheckCircle />, label: 'Routine (Scheduled)' }
    ];

    const quickActions = [
        { icon: <Warning />, text: "I have urgent symptoms", query: "I have urgent symptoms and need an appointment today" },
        { icon: <CalendarToday />, text: "Schedule routine checkup", query: "I need to schedule a routine prenatal checkup" },
        { icon: <AccessTime />, text: "Reschedule appointment", query: "I need to reschedule my existing appointment" },
        { icon: <Person />, text: "Prepare for visit", query: "What should I bring and how should I prepare for my appointment?" }
    ];

    const steps = ['Assess Urgency', 'Gather Information', 'Schedule Appointment'];

    return (
        <>
            <Button
                variant="contained"
                startIcon={<ScheduleIcon />}
                onClick={() => setOpen(true)}
                color="warning"
                sx={{ mb: 2 }}
            >
                Schedule Appointment
            </Button>

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon color="warning" />
                    Appointment Scheduling Assistant
                    <Box sx={{ flexGrow: 1 }} />
                    {nextAppointment && (
                        <Chip
                            label={`Next: ${new Date(nextAppointment.appointment_date).toLocaleDateString()}`}
                            color="info"
                            size="small"
                        />
                    )}
                    <IconButton onClick={() => setOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                            I'll help you determine the right type of appointment and guide you through scheduling.
                            {riskLevel === 'high' && ' As a high-risk patient, some symptoms may need immediate attention.'}
                        </Typography>
                    </Alert>

                    {/* Urgency Assessment */}
                    <Typography variant="h6" gutterBottom>
                        How urgent is your need?
                    </Typography>
                    <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={2} mb={3}>
                        {urgencyLevels.map((urgency, index) => (
                            <Card
                                key={index}
                                sx={{
                                    cursor: 'pointer',
                                    border: appointmentData.urgency === urgency.level ? 2 : 1,
                                    borderColor: appointmentData.urgency === urgency.level ? `${urgency.color}.main` : 'grey.300',
                                    '&:hover': { bgcolor: 'grey.50' }
                                }}
                                onClick={() => setAppointmentData(prev => ({ ...prev, urgency: urgency.level }))}
                            >
                                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                                    <Box color={`${urgency.color}.main`} mb={1}>
                                        {urgency.icon}
                                    </Box>
                                    <Typography variant="body2">
                                        {urgency.label}
                                    </Typography>
                                </CardContent>
                            </Card>
                        ))}
                    </Box>

                    {/* Quick Actions */}
                    <Typography variant="subtitle2" gutterBottom>
                        Quick Actions:
                    </Typography>
                    <List dense sx={{ mb: 2 }}>
                        {quickActions.map((action, index) => (
                            <ListItem
                                key={index}
                                sx={{ border: '1px solid', borderColor: 'grey.300', borderRadius: 1, mb: 1, p: 0 }}
                            >
                                <ListItemButton onClick={() => setQuestion(action.query)}>
                                    <ListItemIcon>{action.icon}</ListItemIcon>
                                    <ListItemText primary={action.text} />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>

                    {/* Question Input */}
                    <Box display="flex" gap={1} mb={2}>
                        <TextField
                            fullWidth
                            placeholder="Describe your symptoms or scheduling needs..."
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
                            color="warning"
                            sx={{ alignSelf: 'flex-start' }}
                        >
                            <SendIcon />
                        </Button>
                    </Box>

                    {loading && <LinearProgress sx={{ mb: 2 }} />}

                    {/* AI Response */}
                    {response && (
                        <Paper sx={{ p: 2, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200' }}>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <Psychology color="warning" />
                                <Typography variant="subtitle2" color="warning.main">
                                    Scheduling Assistant
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                                {response}
                            </Typography>
                        </Paper>
                    )}

                    {/* Emergency Notice */}
                    <Alert severity="error" sx={{ mt: 2 }}>
                        <Typography variant="body2">
                            <strong>Emergency Situations:</strong> If you're experiencing severe symptoms like heavy bleeding,
                            severe headaches with vision changes, or signs of preeclampsia, call 911 or go to the emergency room immediately.
                        </Typography>
                    </Alert>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AppointmentSchedulingBot;