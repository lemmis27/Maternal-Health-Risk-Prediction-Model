from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import openai
import os
from datetime import datetime
import json

# Initialize OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

router = APIRouter(prefix="/api/chat", tags=["chatbot"])
security = HTTPBearer()

class ChatRequest(BaseModel):
    prompt: str
    context: Dict[str, Any] = {}

class ChatResponse(BaseModel):
    response: str
    timestamp: datetime
    tokens_used: Optional[int] = None

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # This should integrate with your existing auth system
    # For now, we'll assume the token is valid
    return {"id": "user_id", "role": "pregnant_mother"}

def create_system_prompt(category: str, context: Dict[str, Any]) -> str:
    """Create specialized system prompts for different chatbot categories"""
    
    base_prompt = f"""You are a specialized maternal health AI assistant providing evidence-based information about pregnancy and prenatal care. 

Current Context:
- User Role: {context.get('userRole', 'pregnant_mother')}
- Gestational Age: {context.get('gestationalAge', 'unknown')} weeks
- Risk Level: {context.get('riskLevel', 'unknown')}
- Date: {datetime.now().strftime('%Y-%m-%d')}

Guidelines:
- Provide accurate, evidence-based medical information
- Always emphasize consulting healthcare providers for medical decisions
- Be empathetic and supportive
- Use clear, understandable language
- Include relevant warnings and safety information
- Format responses with clear sections and bullet points
- Never provide specific medical diagnoses or treatment recommendations
"""

    category_prompts = {
        "health-education": """
Specialty: Pregnancy Health Education

Focus Areas:
- Nutrition and dietary guidelines during pregnancy
- Safe exercise and physical activity recommendations
- Fetal development milestones and what to expect
- Common pregnancy symptoms and management
- Prenatal care schedules and importance
- Lifestyle modifications for healthy pregnancy
- Warning signs that require immediate medical attention

Tailor all advice to the current gestational age and risk level provided in context.
""",

        "shap-analysis": f"""
Specialty: SHAP (AI Risk Factor) Analysis Explanation

You help healthcare providers and patients understand AI-generated risk assessments.

Focus Areas:
- Explain SHAP values and their clinical significance
- Interpret positive vs negative impact factors
- Translate AI predictions into actionable clinical insights
- Help prioritize risk factors for intervention
- Explain confidence levels and prediction reliability

Current Assessment Data: {json.dumps(context.get('assessmentData', {}), indent=2)}
SHAP Features: {json.dumps(context.get('shapData', []), indent=2)}

Provide clear explanations of how each factor contributes to the overall risk assessment.
""",

        "appointment-scheduling": f"""
Specialty: Appointment Scheduling and Medical Triage

Focus Areas:
- Assess urgency of symptoms and concerns
- Guide appropriate appointment types (routine, urgent, emergency)
- Provide preparation instructions for different visit types
- Help determine when immediate medical care is needed
- Explain typical prenatal visit schedules
- Assist with rescheduling considerations

Patient History:
- Last Assessment: {context.get('lastAssessmentDate', 'unknown')}
- Next Scheduled Appointment: {context.get('nextAppointment', {}).get('appointment_date', 'none')}
- Current Risk Level: {context.get('riskLevel', 'unknown')}

Always err on the side of caution and recommend immediate care for concerning symptoms.
""",

        "medication-management": f"""
Specialty: Pregnancy Medication Safety and Management

Focus Areas:
- Medication safety during different pregnancy stages
- Drug interactions and contraindications in pregnancy
- Prenatal vitamin recommendations and timing
- Side effect management strategies
- Proper dosing and administration guidelines
- When to contact healthcare providers about medications

Current Context:
- Gestational Age: {context.get('gestationalAge', 'unknown')} weeks
- Trimester: {get_trimester(context.get('gestationalAge', 0))}
- Current Medications: {json.dumps(context.get('currentMedications', []), indent=2)}
- Known Allergies: {json.dumps(context.get('allergies', []), indent=2)}

Always emphasize the importance of consulting healthcare providers before making any medication changes.
"""
    }

    return base_prompt + category_prompts.get(category, "Focus on general maternal health support and guidance.")

def get_trimester(gestational_age: int) -> str:
    """Determine trimester based on gestational age"""
    if gestational_age <= 12:
        return "1st"
    elif gestational_age <= 28:
        return "2nd"
    else:
        return "3rd"

async def call_openai_intelligent(messages: List[Dict[str, str]], category: str = "general", max_tokens: int = 800) -> Dict[str, Any]:
    """Advanced OpenAI API call with intelligent model selection and robust error handling"""
    
    # Intelligent model selection based on complexity and category
    model = "gpt-3.5-turbo"
    temperature = 0.7
    
    if category == "shap-analysis" or any("comprehensive" in msg.get("content", "").lower() for msg in messages):
        model = "gpt-4"  # Use GPT-4 for complex medical analysis
        temperature = 0.3  # Lower temperature for medical accuracy
        max_tokens = min(max_tokens * 1.5, 1200)  # Allow more tokens for detailed analysis
    elif category == "medication-management":
        temperature = 0.2  # Very low temperature for medication safety
    
    # Retry logic with exponential backoff
    max_retries = 3
    base_delay = 1
    
    for attempt in range(max_retries):
        try:
            response = await openai.ChatCompletion.acreate(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                presence_penalty=0.1,
                frequency_penalty=0.1,
                timeout=30  # 30 second timeout
            )
            
            if response.choices and len(response.choices) > 0:
                content = response.choices[0].message.content.strip()
                
                # Validate response quality
                if len(content) < 10:
                    raise ValueError("Response too short, likely incomplete")
                
                # Check for harmful content patterns
                harmful_patterns = ["I cannot", "I'm not able", "I don't have access"]
                if any(pattern in content for pattern in harmful_patterns):
                    # Try with modified prompt on next attempt
                    if attempt < max_retries - 1:
                        messages[-1]["content"] = f"Please provide helpful medical information about: {messages[-1]['content']}"
                        continue
                
                return {
                    "response": content,
                    "tokens_used": response.usage.total_tokens,
                    "model_used": model,
                    "attempt": attempt + 1
                }
            else:
                raise ValueError("No response choices returned from OpenAI")
                
        except openai.error.RateLimitError as e:
            if attempt == max_retries - 1:
                raise HTTPException(
                    status_code=429, 
                    detail="OpenAI API rate limit exceeded. Please try again in a few minutes."
                )
            # Exponential backoff
            await asyncio.sleep(base_delay * (2 ** attempt))
            
        except openai.error.AuthenticationError:
            raise HTTPException(
                status_code=401, 
                detail="OpenAI API authentication failed. Please check API key configuration."
            )
            
        except openai.error.InvalidRequestError as e:
            # Try with GPT-3.5-turbo if GPT-4 fails
            if model == "gpt-4" and attempt < max_retries - 1:
                model = "gpt-3.5-turbo"
                max_tokens = 800
                continue
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid request to OpenAI API: {str(e)}"
            )
            
        except openai.error.APIError as e:
            if attempt == max_retries - 1:
                raise HTTPException(
                    status_code=500, 
                    detail=f"OpenAI API server error: {str(e)}"
                )
            await asyncio.sleep(base_delay * (2 ** attempt))
            
        except Exception as e:
            if attempt == max_retries - 1:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Unexpected error in AI processing: {str(e)}"
                )
            await asyncio.sleep(base_delay * (2 ** attempt))
    
    # This should never be reached due to the exception handling above
    raise HTTPException(status_code=500, detail="Failed to get response after all retries")

async def generate_intelligent_fallback(prompt: str, category: str, context: Dict[str, Any]) -> str:
    """Generate intelligent fallback responses when OpenAI is unavailable"""
    
    # Extract context information
    risk_level = context.get('riskLevel', 'unknown')
    gestational_age = context.get('gestationalAge', 'unknown')
    user_role = context.get('userRole', 'pregnant_mother')
    
    prompt_lower = prompt.lower()
    
    # Emergency detection with immediate response
    emergency_keywords = ['emergency', 'bleeding', 'severe pain', '911', 'help', 'urgent']
    if any(keyword in prompt_lower for keyword in emergency_keywords):
        return """🚨 **EMERGENCY PROTOCOL**

**IMMEDIATE ACTION REQUIRED:**

Call 911 or go to nearest emergency room if experiencing:
• Heavy bleeding (soaking more than one pad per hour)
• Severe abdominal or pelvic pain
• Severe headaches with vision changes
• Signs of preeclampsia (swelling, protein in urine)
• Decreased fetal movement (after 28 weeks)
• Severe nausea/vomiting preventing fluid intake
• High fever (>101°F/38.3°C)

**For urgent but non-emergency concerns:**
• Contact your healthcare provider immediately
• Use hospital's 24-hour nurse line
• Visit urgent care if OB unavailable

**Remember:** When in doubt, seek immediate medical attention. It's better to be cautious with pregnancy-related symptoms."""

    # SHAP analysis fallback
    if 'shap' in prompt_lower or 'risk factor' in prompt_lower or 'ai prediction' in prompt_lower:
        if user_role == 'clinician':
            return f"""**SHAP Analysis - Clinical Interpretation**

**Current Context:** Risk Level: {risk_level.upper()}, Gestational Age: {gestational_age} weeks

**SHAP (SHapley Additive exPlanations) Clinical Guide:**

**Interpretation Framework:**
• **Positive SHAP values** → Factor increases predicted risk
• **Negative SHAP values** → Factor decreases predicted risk
• **Magnitude** → Strength of contribution to prediction

**Clinical Application:**
1. **Risk Stratification:** Use SHAP values to prioritize interventions
2. **Patient Communication:** Explain which factors drive their risk
3. **Care Planning:** Focus on modifiable high-impact factors
4. **Monitoring:** Track changes in key SHAP contributors over time

**Evidence-Based Integration:**
• Combine SHAP insights with clinical guidelines (ACOG, WHO)
• Consider patient-specific factors not captured in model
• Use for shared decision-making with patients
• Document rationale for care plan modifications

**Quality Assurance:**
• Validate SHAP explanations against clinical knowledge
• Monitor for model drift or unexpected patterns
• Maintain clinical oversight of AI recommendations"""
        else:
            return f"""**Understanding Your AI Risk Assessment**

**Your Current Status:** {risk_level.upper()} risk at {gestational_age} weeks

**How AI Risk Prediction Works:**

**What We Analyze:**
• Blood pressure readings
• Blood sugar levels
• Age and pregnancy history
• Heart rate and vital signs
• Gestational age progression

**What SHAP Explanations Show:**
• Which health factors are most important for YOUR specific situation
• Whether each factor increases or decreases your risk
• How strongly each factor influences the prediction

**What This Means for Your Care:**
• Higher risk doesn't mean problems will definitely occur
• It helps your healthcare team provide more personalized care
• You can work on modifiable factors (diet, exercise, stress)
• Regular monitoring helps track improvements

**Important Reminders:**
• AI predictions support, never replace, your doctor's judgment
• Always discuss results with your healthcare provider
• Focus on factors you can control
• Stay positive - most pregnancies have good outcomes"""

    # Medication safety fallback
    if 'medication' in prompt_lower or 'drug' in prompt_lower or 'medicine' in prompt_lower:
        trimester = "1st" if gestational_age and int(str(gestational_age).split()[0]) <= 12 else \
                   "2nd" if gestational_age and int(str(gestational_age).split()[0]) <= 28 else "3rd"
        
        return f"""**Medication Safety During Pregnancy - {trimester} Trimester**

**CRITICAL SAFETY RULE:** Always consult your healthcare provider before taking ANY medication during pregnancy.

**Generally Safe Medications:**
• Prenatal vitamins (essential daily)
• Folic acid (400-800 mcg)
• Acetaminophen/Tylenol (for pain/fever)
• Some antibiotics (amoxicillin, penicillin)
• Iron supplements (if prescribed)

**AVOID During Pregnancy:**
• Ibuprofen/NSAIDs (especially 3rd trimester)
• Aspirin (except low-dose if prescribed)
• Most herbal supplements
• Isotretinoin (acne medication)
• ACE inhibitors

**{trimester} Trimester Considerations:**
{
"1st": "• Critical organ development period\n• Avoid all unnecessary medications\n• Focus on prenatal vitamins and folic acid",
"2nd": "• Safest period for necessary medications\n• Good time for dental procedures if needed\n• Continue prenatal vitamins",
"3rd": "• Some medications become riskier\n• Prepare for breastfeeding considerations\n• Avoid NSAIDs completely"
}.get(trimester, "")

**Emergency Contacts:**
• Poison Control: 1-800-222-1222
• Your OB/GYN: [Contact your provider]
• Pharmacist: Available for drug interaction questions

**Documentation:** Keep a list of all medications, vitamins, and supplements to share with all healthcare providers."""

    # Default intelligent response based on context
    context_responses = {
        'high': f"""**High Risk Pregnancy Support - Week {gestational_age}**

**Your Care Team is Here for You:**
High risk doesn't mean complications will occur - it means we're providing enhanced monitoring for the best possible outcomes.

**Enhanced Care Plan:**
• More frequent prenatal visits
• Specialized monitoring and testing
• Direct access to maternal-fetal medicine specialists
• Coordinated care team approach

**What You Can Do:**
• Attend all scheduled appointments
• Monitor symptoms and report changes immediately
• Maintain healthy lifestyle modifications
• Stay connected with your support system

**Warning Signs to Report Immediately:**
• Severe headaches or vision changes
• Unusual swelling
• Decreased fetal movement
• Persistent nausea/vomiting
• Any concerning symptoms

**Remember:** High-risk pregnancies often result in healthy babies with proper care and monitoring.""",

        'medium': f"""**Medium Risk Pregnancy Guidance - Week {gestational_age}**

**Balanced Care Approach:**
Your risk level indicates the need for some additional precautions while maintaining optimism for a healthy pregnancy.

**Care Schedule:**
• Regular prenatal visits with possible additional monitoring
• Targeted screening based on your specific risk factors
• Open communication with healthcare team
• Proactive management of modifiable factors

**Lifestyle Optimization:**
• Maintain balanced nutrition
• Appropriate exercise as approved by provider
• Stress management techniques
• Adequate rest and sleep

**Stay Informed:**
• Learn about warning signs
• Understand your specific risk factors
• Ask questions during appointments
• Build your support network""",

        'low': f"""**Low Risk Pregnancy Support - Week {gestational_age}**

**Excellent News:**
Your current assessment indicates low risk, which means you can focus on maintaining wellness and enjoying your pregnancy journey.

**Routine Care:**
• Standard prenatal appointment schedule
• Routine screening and testing
• Focus on healthy lifestyle habits
• Preparation for parenthood

**Wellness Maintenance:**
• Balanced nutrition with prenatal vitamins
• Regular approved physical activity
• Stress management and relaxation
• Building your support network

**Stay Engaged:**
• Continue all scheduled appointments
• Report any new symptoms or concerns
• Maintain healthy habits
• Prepare for upcoming milestones"""
    }
    
    return context_responses.get(risk_level, context_responses['low'])

# Add asyncio import at the top
import asyncio

@router.post("/health-education", response_model=ChatResponse)
async def health_education_chat(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """Advanced health education chatbot endpoint with intelligent fallback"""
    
    try:
        system_prompt = create_system_prompt("health-education", request.context)
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.prompt}
        ]
        
        result = await call_openai_intelligent(messages, "health-education")
        
        return ChatResponse(
            response=result["response"],
            timestamp=datetime.now(),
            tokens_used=result.get("tokens_used")
        )
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        # Use intelligent fallback
        fallback_response = await generate_intelligent_fallback(
            request.prompt, 
            "health-education", 
            request.context
        )
        
        return ChatResponse(
            response=f"{fallback_response}\n\n*Note: AI service temporarily unavailable. Using enhanced fallback system.*",
            timestamp=datetime.now(),
            tokens_used=0
        )

@router.post("/shap-analysis", response_model=ChatResponse)
async def shap_analysis_chat(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """Advanced SHAP analysis explanation chatbot endpoint with clinical intelligence"""
    
    try:
        system_prompt = create_system_prompt("shap-analysis", request.context)
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.prompt}
        ]
        
        result = await call_openai_intelligent(messages, "shap-analysis", max_tokens=1200)
        
        return ChatResponse(
            response=result["response"],
            timestamp=datetime.now(),
            tokens_used=result.get("tokens_used")
        )
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        # Use intelligent fallback for SHAP analysis
        fallback_response = await generate_intelligent_fallback(
            request.prompt, 
            "shap-analysis", 
            request.context
        )
        
        return ChatResponse(
            response=f"{fallback_response}\n\n*Note: Advanced AI analysis temporarily unavailable. Using clinical knowledge base.*",
            timestamp=datetime.now(),
            tokens_used=0
        )

@router.post("/appointment-scheduling", response_model=ChatResponse)
async def appointment_scheduling_chat(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """Advanced appointment scheduling guidance chatbot endpoint with intelligent triage"""
    
    try:
        system_prompt = create_system_prompt("appointment-scheduling", request.context)
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.prompt}
        ]
        
        result = await call_openai_intelligent(messages, "appointment-scheduling")
        
        return ChatResponse(
            response=result["response"],
            timestamp=datetime.now(),
            tokens_used=result.get("tokens_used")
        )
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        # Use intelligent fallback for appointment scheduling
        fallback_response = await generate_intelligent_fallback(
            request.prompt, 
            "appointment-scheduling", 
            request.context
        )
        
        return ChatResponse(
            response=f"{fallback_response}\n\n*Note: AI scheduling assistant temporarily unavailable. Using clinical triage protocols.*",
            timestamp=datetime.now(),
            tokens_used=0
        )

@router.post("/medication-management", response_model=ChatResponse)
async def medication_management_chat(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """Advanced medication management chatbot endpoint with safety-focused intelligence"""
    
    try:
        system_prompt = create_system_prompt("medication-management", request.context)
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.prompt}
        ]
        
        result = await call_openai_intelligent(messages, "medication-management")
        
        return ChatResponse(
            response=result["response"],
            timestamp=datetime.now(),
            tokens_used=result.get("tokens_used")
        )
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        # Use intelligent fallback for medication management
        fallback_response = await generate_intelligent_fallback(
            request.prompt, 
            "medication-management", 
            request.context
        )
        
        return ChatResponse(
            response=f"{fallback_response}\n\n*Note: AI medication advisor temporarily unavailable. Using clinical safety protocols.*",
            timestamp=datetime.now(),
            tokens_used=0
        )

@router.post("/general", response_model=ChatResponse)
async def general_chat(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """Advanced general maternal health chatbot endpoint with intelligent context awareness"""
    
    try:
        system_prompt = create_system_prompt("general", request.context)
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.prompt}
        ]
        
        result = await call_openai_intelligent(messages, "general")
        
        return ChatResponse(
            response=result["response"],
            timestamp=datetime.now(),
            tokens_used=result.get("tokens_used")
        )
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        # Use intelligent fallback for general chat
        fallback_response = await generate_intelligent_fallback(
            request.prompt, 
            "general", 
            request.context
        )
        
        return ChatResponse(
            response=f"{fallback_response}\n\n*Note: AI assistant temporarily unavailable. Using intelligent knowledge base.*",
            timestamp=datetime.now(),
            tokens_used=0
        )

@router.get("/health")
async def chatbot_health():
    """Health check endpoint for chatbot service"""
    
    if not openai.api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    try:
        # Test OpenAI connection
        response = await openai.ChatCompletion.acreate(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=5
        )
        
        return {
            "status": "healthy",
            "openai_configured": True,
            "timestamp": datetime.now()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "openai_configured": False,
            "error": str(e),
            "timestamp": datetime.now()
        }

# Add this router to your main FastAPI app:
# app.include_router(router)