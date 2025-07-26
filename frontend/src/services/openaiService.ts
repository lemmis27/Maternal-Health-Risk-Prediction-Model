import axios from 'axios';

// OpenAI API configuration
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens: number;
  temperature: number;
}

interface ChatContext {
  userRole?: string;
  gestationalAge?: number;
  riskLevel?: string;
  motherId?: string;
  assessmentData?: any;
  shapData?: any[];
  currentMedications?: any[];
  allergies?: string[];
  lastAssessmentDate?: string;
  nextAppointment?: any;
}

class OpenAIService {
  private apiKey: string;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();
  private rateLimitTracker: Map<string, { count: number; resetTime: number }> = new Map();
  private responseCache: Map<string, { response: string; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_REQUESTS_PER_MINUTE = 20;

  constructor() {
    this.apiKey = OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('OpenAI API key not found. Using fallback responses.');
    }

    // Clean up old cache entries every 10 minutes
    setInterval(() => this.cleanupCache(), 10 * 60 * 1000);
  }

  private cleanupCache(): void {
    const now = Date.now();
    const entries = Array.from(this.responseCache.entries());
    for (const [key, value] of entries) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.responseCache.delete(key);
      }
    }
  }

  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.rateLimitTracker.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      this.rateLimitTracker.set(userId, { count: 1, resetTime: now + 60000 });
      return true;
    }

    if (userLimit.count >= this.MAX_REQUESTS_PER_MINUTE) {
      return false;
    }

    userLimit.count++;
    return true;
  }

  private getCacheKey(prompt: string, context: ChatContext): string {
    return btoa(JSON.stringify({ prompt: prompt.substring(0, 100), context }));
  }

  private createSystemPrompt(category: string, context: ChatContext): string {
    const basePrompt = `You are a specialized maternal health AI assistant. You provide accurate, evidence-based information about pregnancy, maternal health, and prenatal care. Always emphasize the importance of consulting healthcare providers for medical decisions.

Context:
- User Role: ${context.userRole || 'pregnant_mother'}
- Gestational Age: ${context.gestationalAge || 'unknown'} weeks
- Risk Level: ${context.riskLevel || 'unknown'}
- Current Date: ${new Date().toLocaleDateString()}

Guidelines:
- Provide clear, actionable information
- Use appropriate medical terminology with explanations
- Always recommend consulting healthcare providers for medical decisions
- Be empathetic and supportive
- Include relevant warnings and safety information
- Format responses with clear sections and bullet points
`;

    switch (category) {
      case 'health-education':
        return basePrompt + `
Specialty: Pregnancy Health Education
Focus on:
- Nutrition and dietary guidelines
- Safe exercise during pregnancy
- Fetal development milestones
- Common pregnancy symptoms
- Prenatal care recommendations
- Lifestyle modifications
- Warning signs to watch for

Tailor advice to the current gestational age and risk level.`;

      case 'shap-analysis':
        return basePrompt + `
Specialty: SHAP (AI Risk Factor) Analysis Explanation
Focus on:
- Explaining SHAP values and their meaning
- Interpreting positive vs negative impacts
- Clinical significance of risk factors
- How AI predictions work
- Actionable insights for healthcare providers
- Risk factor prioritization

Current SHAP Data: ${JSON.stringify(context.shapData || [])}
Assessment Data: ${JSON.stringify(context.assessmentData || {})}`;

      case 'appointment-scheduling':
        return basePrompt + `
Specialty: Appointment Scheduling and Triage
Focus on:
- Urgency assessment (emergency, urgent, routine)
- Appropriate appointment types
- Preparation instructions
- When to seek immediate care
- Scheduling best practices
- Symptom evaluation for triage

Last Assessment: ${context.lastAssessmentDate || 'unknown'}
Next Appointment: ${context.nextAppointment ? new Date(context.nextAppointment.appointment_date).toLocaleDateString() : 'none scheduled'}`;

      case 'medication-management':
        return basePrompt + `
Specialty: Pregnancy Medication Safety and Management
Focus on:
- Medication safety during pregnancy
- Drug interactions and contraindications
- Prenatal vitamin guidance
- Side effect management
- Timing and dosing recommendations
- When to contact healthcare providers

Current Medications: ${JSON.stringify(context.currentMedications || [])}
Known Allergies: ${JSON.stringify(context.allergies || [])}
Trimester: ${context.gestationalAge ? (context.gestationalAge <= 12 ? '1st' : context.gestationalAge <= 28 ? '2nd' : '3rd') : 'unknown'}`;

      case 'general':
      default:
        return basePrompt + `
Specialty: General Maternal Health Support
Focus on:
- General pregnancy questions
- System navigation help
- Health education basics
- When to seek care
- Emotional support and reassurance
- Resource recommendations`;
    }
  }

  private async getIntelligentResponse(
    userMessage: string,
    category: string,
    context: ChatContext,
    userId: string = 'default'
  ): Promise<string> {
    // Check rate limiting
    if (!this.checkRateLimit(userId)) {
      throw new Error('Rate limit exceeded. Please wait before making another request.');
    }

    // Check cache first
    const cacheKey = this.getCacheKey(userMessage, context);
    const cached = this.responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.response;
    }

    // Get conversation history for context
    const conversationId = `${userId}-${category}`;
    const history = this.conversationHistory.get(conversationId) || [];

    // Create enhanced system prompt with conversation context
    const systemPrompt = this.createEnhancedSystemPrompt(category, context, history);

    // Build messages with conversation history (last 4 exchanges)
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8), // Last 4 exchanges (user + assistant pairs)
      { role: 'user', content: userMessage }
    ];

    // Determine optimal model and parameters based on complexity
    const { model, maxTokens, temperature } = this.getOptimalParameters(userMessage, category);

    const requestData: OpenAIRequest = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature
    };

    const response = await axios.post(OPENAI_API_URL, requestData, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    if (response.data.choices && response.data.choices.length > 0) {
      const aiResponse = response.data.choices[0].message.content.trim();

      // Update conversation history
      history.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: aiResponse }
      );

      // Keep only last 10 exchanges (20 messages)
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }

      this.conversationHistory.set(conversationId, history);

      // Cache the response
      this.responseCache.set(cacheKey, { response: aiResponse, timestamp: Date.now() });

      return aiResponse;
    } else {
      throw new Error('No response from OpenAI');
    }
  }

  private createEnhancedSystemPrompt(category: string, context: ChatContext, history: ChatMessage[]): string {
    const basePrompt = this.createSystemPrompt(category, context);

    // Add conversation context awareness
    const conversationContext = history.length > 0 ? `
Previous Conversation Context:
- You have been discussing ${category} topics with this user
- Maintain consistency with previous responses
- Build upon previous information shared
- Reference earlier points when relevant
` : '';

    // Add intelligent context based on risk level and gestational age
    const intelligentContext = this.getIntelligentContext(context);

    return basePrompt + conversationContext + intelligentContext;
  }

  private getIntelligentContext(context: ChatContext): string {
    const { gestationalAge, riskLevel, userRole } = context;

    let intelligentPrompts = '\nIntelligent Context Awareness:\n';

    // Gestational age-specific intelligence
    if (gestationalAge) {
      if (gestationalAge <= 12) {
        intelligentPrompts += '- First trimester: Focus on early pregnancy concerns, nausea management, folic acid importance\n';
      } else if (gestationalAge <= 28) {
        intelligentPrompts += '- Second trimester: Emphasize anatomy scans, glucose testing, fetal movement\n';
      } else {
        intelligentPrompts += '- Third trimester: Focus on birth preparation, warning signs, delivery planning\n';
      }
    }

    // Risk-specific intelligence
    if (riskLevel === 'high') {
      intelligentPrompts += '- HIGH RISK: Emphasize immediate medical attention, frequent monitoring, specialist care\n';
    } else if (riskLevel === 'medium') {
      intelligentPrompts += '- MEDIUM RISK: Balance reassurance with appropriate caution, enhanced monitoring\n';
    } else if (riskLevel === 'low') {
      intelligentPrompts += '- LOW RISK: Provide reassurance while maintaining standard care recommendations\n';
    }

    // Role-specific intelligence
    if (userRole === 'clinician') {
      intelligentPrompts += '- CLINICIAN USER: Provide detailed clinical information, evidence-based guidelines, differential diagnoses\n';
    } else if (userRole === 'chv') {
      intelligentPrompts += '- CHV USER: Focus on community health protocols, when to refer, patient education\n';
    } else {
      intelligentPrompts += '- PATIENT USER: Use accessible language, provide emotional support, emphasize when to seek help\n';
    }

    return intelligentPrompts;
  }

  private getOptimalParameters(userMessage: string, category: string): { model: string; maxTokens: number; temperature: number } {
    const messageLength = userMessage.length;
    const isComplex = userMessage.includes('explain') || userMessage.includes('analyze') || userMessage.includes('comprehensive');

    // Use GPT-4 for complex medical analysis, GPT-3.5-turbo for general queries
    if (category === 'shap-analysis' || isComplex || messageLength > 200) {
      return {
        model: 'gpt-4', // Fallback to gpt-3.5-turbo if GPT-4 not available
        maxTokens: 1200,
        temperature: 0.3 // Lower temperature for medical accuracy
      };
    }

    return {
      model: 'gpt-3.5-turbo',
      maxTokens: 800,
      temperature: 0.7
    };
  }

  async getChatResponse(
    userMessage: string,
    category: string = 'general',
    context: ChatContext = {},
    userId: string = 'default'
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      return await this.getIntelligentResponse(userMessage, category, context, userId);
    } catch (error: any) {
      console.error('OpenAI API Error:', error);

      // Intelligent error handling with specific responses
      if (error.response?.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your configuration.');
      } else if (error.response?.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again in a few minutes.');
      } else if (error.response?.status === 500) {
        throw new Error('OpenAI API server error. Using fallback response system.');
      } else if (error.message?.includes('Rate limit exceeded')) {
        throw new Error('Too many requests. Please wait before asking another question.');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout. Please try again with a shorter question.');
      } else {
        throw new Error(`AI service temporarily unavailable: ${error.message}`);
      }
    }
  }

  // Specialized methods for different chatbot types
  async getHealthEducationResponse(
    question: string,
    gestationalAge: number,
    riskLevel: string,
    topic: string = 'general'
  ): Promise<string> {
    return this.getChatResponse(
      `${topic}: ${question}`,
      'health-education',
      { gestationalAge, riskLevel }
    );
  }

  async getShapExplanation(
    question: string,
    shapData: any[],
    assessmentData: any,
    riskLevel: string
  ): Promise<string> {
    return this.getChatResponse(
      question,
      'shap-analysis',
      { shapData, assessmentData, riskLevel }
    );
  }

  async getAppointmentGuidance(
    symptoms: string,
    urgency: string,
    context: ChatContext
  ): Promise<string> {
    return this.getChatResponse(
      `Symptoms: ${symptoms}. Urgency level: ${urgency}. Please provide scheduling guidance.`,
      'appointment-scheduling',
      context
    );
  }

  async getMedicationAdvice(
    question: string,
    currentMedications: any[],
    gestationalAge: number,
    allergies: string[] = []
  ): Promise<string> {
    return this.getChatResponse(
      question,
      'medication-management',
      { currentMedications, gestationalAge, allergies }
    );
  }

  // Utility method to check if API is configured
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // Method to validate API key
  async validateApiKey(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await axios.post(
        OPENAI_API_URL,
        {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();
export default openAIService;