# 👥 User Guide
## Maternal Health Risk Prediction System

---

## 📖 **Welcome to the Maternal Health System**

This comprehensive guide will help you navigate and use the Maternal Health Risk Prediction System effectively. The system is designed to support healthcare providers and pregnant mothers in monitoring and managing maternal health risks.

---

## 🎯 **System Overview**

### **What is the Maternal Health System?**
The Maternal Health Risk Prediction System is a web-based application that uses artificial intelligence to assess and predict maternal health risks during pregnancy. It provides healthcare workers with data-driven insights to make informed decisions about patient care.

### **Who Can Use This System?**
- **Pregnant Mothers** - Monitor their health and access educational resources
- **Community Health Volunteers (CHVs)** - Conduct assessments and monitor assigned patients
- **Clinicians** - Review patient data, make diagnoses, and manage treatments
- **Administrators** - Oversee system operations and generate reports

---

## 🔔 **Real-time Notifications**

### **Notification System Overview**
The system provides real-time notifications to keep you informed about important events:

- **Critical Health Alerts** - Immediate notifications for high-risk assessments
- **Appointment Reminders** - Automated reminders for upcoming appointments  
- **System Updates** - Important system announcements and updates
- **Assignment Notifications** - Alerts when patients are assigned to healthcare providers

### **Notification Types by Role**

#### **For Pregnant Mothers:**
- Health assessment results and recommendations
- Appointment reminders and confirmations
- Medication reminders
- Educational health tips

#### **For CHVs (Community Health Volunteers):**
- New patient assignments
- High-risk assessment alerts for assigned patients
- Appointment scheduling notifications
- System updates and training materials

#### **For Clinicians:**
- Critical patient alerts requiring immediate attention
- New patient referrals from CHVs
- Assessment completion notifications
- Appointment confirmations

#### **For Administrators:**
- System performance alerts
- User activity summaries
- Critical case escalations
- System maintenance notifications

### **Using Notifications**

1. **Notification Bell** - Click the bell icon in the top navigation to view notifications
2. **Real-time Updates** - Notifications appear automatically without page refresh
3. **Critical Alerts** - High-priority alerts show as modal dialogs requiring acknowledgment
4. **Browser Notifications** - Enable browser notifications for alerts when app is not active
5. **Connection Status** - Green dot indicates real-time connection is active

### **Managing Notifications**

- **Mark as Read** - Click on notifications to mark them as read
- **Acknowledge Critical Alerts** - Critical alerts require explicit acknowledgment
- **Notification History** - View past notifications in the notification center
- **Sound Alerts** - Critical alerts include audio notifications (if enabled)

---

## 🚀 **Getting Started**

### **Accessing the System**

#### **Development Environment**
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

#### **Production Environment**
- **Application:** http://localhost:8000 (or your domain)
- **With Nginx:** http://localhost (port 80)

### **System Requirements**
- **Web Browser:** Chrome, Firefox, Safari, or Edge (latest versions)
- **Internet Connection:** Stable internet connection required
- **Screen Resolution:** Minimum 1024x768 (responsive design supports mobile)

---

## 🔐 **User Registration & Login**

### **Creating an Account**

1. **Navigate to Registration Page**
   - Click "Register" on the login page
   - Or visit `/register` directly

2. **Fill Registration Form**
   ```
   Username: Choose a unique username
   Email: Your valid email address
   Full Name: Your complete name
   Role: Select your role (Pregnant Mother, CHV, Clinician, Admin)
   Phone Number: Your contact number
   Location: Your current location
   Password: Strong password (minimum 8 characters)
   ```

3. **Submit Registration**
   - Click "Register" button
   - System will create your account
   - For pregnant mothers, a patient ID will be automatically generated

### **Logging In**

1. **Enter Credentials**
   - Username or email
   - Password

2. **Access Token**
   - System generates secure JWT token
   - Token expires after 30 minutes for security
   - Automatic refresh available

3. **Dashboard Access**
   - Redirected to role-specific dashboard
   - Navigation menu appears based on permissions

---

## 👩‍🤱 **For Pregnant Mothers**

### **Your Dashboard**
When you log in as a pregnant mother, you'll see:
- **Health Overview:** Current risk level and recent assessments
- **Upcoming Appointments:** Scheduled visits with healthcare providers
- **Health Education:** Pregnancy tips and educational content
- **Emergency Contacts:** Quick access to healthcare providers

### **Viewing Your Health Data**

#### **Risk Assessments**
- **Current Risk Level:** Low, Medium, or High
- **Risk Score:** Numerical confidence score
- **Assessment History:** Timeline of all assessments
- **Recommendations:** Personalized health advice

#### **Understanding Your Risk Level**

**🟢 Low Risk**
- Continue regular prenatal care
- Maintain healthy lifestyle
- Next routine check-up as scheduled

**🟡 Medium Risk**
- Schedule follow-up within 1 week
- Monitor symptoms closely
- Maintain regular prenatal visits

**🔴 High Risk**
- Immediate medical attention required
- Contact your clinician immediately
- Consider hospitalization for monitoring

### **Health Education Resources**
- **Pregnancy Stages:** Information about each trimester
- **Nutrition Guidelines:** Healthy eating during pregnancy
- **Exercise Recommendations:** Safe physical activities
- **Warning Signs:** When to seek immediate help
- **Medication Information:** Safe medications during pregnancy

### **Chatbot Assistant**
- **24/7 Availability:** Get answers anytime
- **Health Questions:** Ask about symptoms or concerns
- **Appointment Scheduling:** Book visits with providers
- **Medication Reminders:** Track your prescriptions

---

## 👨‍⚕️ **For Community Health Volunteers (CHVs)**

### **CHV Dashboard**
Your dashboard provides:
- **Assigned Patients:** List of pregnant mothers under your care
- **Risk Alerts:** Patients requiring immediate attention
- **Assessment Tools:** Risk assessment forms
- **Performance Metrics:** Your work statistics

### **Conducting Risk Assessments**

#### **Step 1: Select Patient**
- Choose patient from your assigned list
- Or search by name/ID
- View patient's medical history

#### **Step 2: Gather Vital Signs**
```
Required Measurements:
✓ Age (years)
✓ Systolic Blood Pressure (mmHg)
✓ Diastolic Blood Pressure (mmHg)
✓ Blood Sugar Level (mmol/L)
✓ Body Temperature (°F)
✓ Heart Rate (BPM)
✓ Gestational Age (weeks)
✓ Weight (kg)
✓ Height (cm)
```

#### **Step 3: Record Symptoms**
- Select from common symptoms list
- Add custom symptoms if needed
- Include severity and duration
- Add clinical notes

#### **Step 4: Submit Assessment**
- Review all entered data
- Click "Submit Assessment"
- System calculates risk level automatically
- View AI explanation of results

### **Understanding AI Predictions**

#### **SHAP Explanations**
The system provides explanations for each prediction:
- **Feature Importance:** Which vital signs influenced the prediction most
- **Positive/Negative Impact:** How each measurement affects risk
- **Confidence Score:** How certain the AI is about the prediction

#### **Example Explanation**
```
Risk Level: Medium Risk (Confidence: 85%)

Contributing Factors:
🔴 Systolic BP (140 mmHg): +0.25 (increases risk)
🟡 Age (35 years): +0.12 (slightly increases risk)
🟢 Heart Rate (72 BPM): -0.08 (decreases risk)
🟢 Body Temperature (98.6°F): -0.03 (normal)

Recommendation: Monitor blood pressure closely, schedule follow-up within 1 week
```

### **Patient Management**

#### **Patient List View**
- **Risk Status:** Color-coded risk levels
- **Last Assessment:** Date of most recent evaluation
- **Trends:** Risk level changes over time
- **Contact Information:** Phone numbers and emergency contacts

#### **Patient Details**
- **Medical History:** Previous pregnancies and complications
- **Assessment Timeline:** All risk assessments with trends
- **Appointments:** Scheduled and completed visits
- **Medications:** Current prescriptions and adherence

### **Appointment Scheduling**
- **Book Appointments:** Schedule visits with clinicians
- **Calendar View:** See all appointments at a glance
- **Reminders:** Automatic notifications for upcoming visits
- **Rescheduling:** Easy appointment modifications

---

## 👨‍⚕️ **For Clinicians**

### **Clinician Dashboard**
Your comprehensive view includes:
- **Patient Overview:** All patients under your care
- **High-Risk Alerts:** Patients requiring immediate attention
- **Appointment Schedule:** Today's and upcoming appointments
- **Analytics:** Population health insights

### **Patient Management**

#### **Patient List Features**
- **Advanced Filtering:** Filter by risk level, CHV, date range
- **Sorting Options:** Sort by risk, last assessment, name
- **Search Functionality:** Quick patient lookup
- **Bulk Actions:** Mass updates and communications

#### **Individual Patient View**
- **Complete Medical History:** All assessments and trends
- **Risk Progression:** Visual charts showing risk changes
- **CHV Notes:** Community health volunteer observations
- **Treatment History:** Previous interventions and outcomes

### **Clinical Decision Support**

#### **Risk Assessment Review**
- **AI Predictions:** Machine learning risk assessments
- **Clinical Validation:** Override AI predictions if needed
- **Evidence Base:** View data supporting predictions
- **Peer Comparisons:** Similar patient outcomes

#### **Treatment Recommendations**
Based on risk level and patient history:
- **Medication Suggestions:** Evidence-based prescriptions
- **Monitoring Frequency:** Recommended follow-up intervals
- **Specialist Referrals:** When to involve other specialists
- **Lifestyle Interventions:** Non-pharmacological treatments

### **Prescription Management**

#### **Electronic Prescribing**
- **Medication Database:** Comprehensive drug information
- **Dosage Calculator:** Weight and condition-based dosing
- **Interaction Checker:** Drug-drug and drug-condition interactions
- **Pregnancy Safety:** Medication safety during pregnancy

#### **Prescription Tracking**
- **Adherence Monitoring:** Patient compliance tracking
- **Refill Reminders:** Automatic prescription renewals
- **Side Effect Reporting:** Adverse event documentation
- **Effectiveness Assessment:** Treatment outcome evaluation

### **Analytics and Reporting**

#### **Population Health Insights**
- **Risk Distribution:** Overview of patient risk levels
- **Trend Analysis:** Changes in population health over time
- **Outcome Metrics:** Treatment effectiveness statistics
- **Resource Utilization:** Healthcare resource usage patterns

#### **Quality Metrics**
- **Clinical Indicators:** Key performance indicators
- **Benchmark Comparisons:** Performance against standards
- **Improvement Opportunities:** Areas for enhancement
- **Patient Satisfaction:** Feedback and satisfaction scores

---

## 👨‍💼 **For Administrators**

### **Admin Dashboard**
Complete system oversight including:
- **System Health:** Server and database status
- **User Management:** All system users and roles
- **Analytics:** Comprehensive system usage statistics
- **Configuration:** System settings and parameters

### **User Management**

#### **User Administration**
- **User Creation:** Add new users to the system
- **Role Assignment:** Assign and modify user roles
- **Permission Management:** Granular access control
- **Account Status:** Activate, deactivate, or suspend accounts

#### **Bulk Operations**
- **CSV Import:** Import multiple users from spreadsheet
- **Bulk Updates:** Mass changes to user information
- **Group Management:** Organize users by location or role
- **Communication:** Send system-wide announcements

### **System Configuration**

#### **Clinical Parameters**
- **Risk Thresholds:** Adjust AI prediction thresholds
- **Clinical Ranges:** Modify acceptable vital sign ranges
- **Alert Settings:** Configure system notifications
- **Workflow Rules:** Customize business logic

#### **Security Settings**
- **Password Policies:** Set password requirements
- **Session Management:** Configure timeout settings
- **Access Controls:** Define role-based permissions
- **Audit Logging:** Track all system activities

### **Analytics and Reporting**

#### **System Usage Statistics**
- **User Activity:** Login patterns and usage metrics
- **Feature Utilization:** Most and least used features
- **Performance Metrics:** System response times and errors
- **Capacity Planning:** Resource usage trends

#### **Clinical Outcomes**
- **Population Health:** Overall maternal health trends
- **Risk Prediction Accuracy:** AI model performance
- **Intervention Effectiveness:** Treatment outcome analysis
- **Quality Indicators:** Clinical quality metrics

### **Data Management**

#### **Database Administration**
- **Backup Management:** Schedule and monitor backups
- **Data Integrity:** Ensure data consistency and accuracy
- **Performance Optimization:** Database tuning and indexing
- **Migration Tools:** Data import and export utilities

#### **Compliance and Auditing**
- **HIPAA Compliance:** Healthcare data protection
- **Audit Trails:** Complete activity logging
- **Data Retention:** Manage data lifecycle policies
- **Privacy Controls:** Patient data access restrictions

---

## 🤖 **Using the AI Chatbot**

### **Chatbot Features**
The integrated AI chatbot provides:
- **Health Education:** Pregnancy and maternal health information
- **Appointment Scheduling:** Book and manage appointments
- **Medication Management:** Prescription reminders and information
- **Symptom Assessment:** Basic health screening

### **How to Use the Chatbot**

#### **Starting a Conversation**
1. Click the chat icon (usually in bottom-right corner)
2. Type your question or select from suggested topics
3. Chatbot responds with relevant information
4. Continue the conversation as needed

#### **Common Questions**
- "What should I eat during pregnancy?"
- "When is my next appointment?"
- "What are the warning signs I should watch for?"
- "How do I take my medication?"
- "What does my risk level mean?"

#### **Appointment Scheduling via Chatbot**
1. Say "I want to schedule an appointment"
2. Chatbot will ask for preferred date and time
3. System checks availability with your assigned clinician
4. Confirms appointment and sends reminders

---

## 📊 **Understanding Reports and Analytics**

### **Risk Assessment Reports**

#### **Individual Patient Reports**
- **Risk Timeline:** Visual representation of risk changes
- **Vital Signs Trends:** Charts showing measurement patterns
- **Intervention Outcomes:** Effects of treatments over time
- **Prediction Accuracy:** How well AI predictions matched outcomes

#### **Population Reports**
- **Risk Distribution:** Percentage of patients in each risk category
- **Geographic Analysis:** Risk patterns by location
- **Demographic Insights:** Risk factors by age, parity, etc.
- **Seasonal Trends:** Time-based risk pattern analysis

### **Performance Dashboards**

#### **CHV Performance**
- **Patient Load:** Number of assigned patients
- **Assessment Frequency:** How often assessments are conducted
- **Risk Detection:** Success in identifying high-risk patients
- **Patient Outcomes:** Health improvements in assigned patients

#### **Clinician Performance**
- **Patient Volume:** Number of patients under care
- **Response Time:** Speed of responding to high-risk alerts
- **Treatment Effectiveness:** Success rates of interventions
- **Patient Satisfaction:** Feedback scores from patients

---

## 🔧 **Troubleshooting Common Issues**

### **Login Problems**

#### **Forgot Password**
1. Click "Forgot Password" on login page
2. Enter your email address
3. Check email for reset instructions
4. Follow link to create new password

#### **Account Locked**
- **Cause:** Too many failed login attempts
- **Solution:** Wait 15 minutes or contact administrator
- **Prevention:** Use correct credentials and strong passwords

### **Data Entry Issues**

#### **Validation Errors**
- **Blood Pressure:** Ensure systolic > diastolic
- **Age:** Must be between 15-50 years
- **Temperature:** Must be in Fahrenheit (95-106°F)
- **Heart Rate:** Must be between 40-150 BPM

#### **Missing Data**
- **Required Fields:** All vital signs must be entered
- **Patient Information:** Ensure patient is properly registered
- **Assessment Date:** Cannot be in the future

### **Performance Issues**

#### **Slow Loading**
- **Check Internet:** Ensure stable connection
- **Clear Cache:** Clear browser cache and cookies
- **Update Browser:** Use latest browser version
- **Contact Support:** If issues persist

#### **System Errors**
- **Refresh Page:** Try reloading the page
- **Log Out/In:** Sign out and sign back in
- **Check Status:** Visit system status page
- **Report Issue:** Contact technical support

---

## 📞 **Getting Help and Support**

### **In-App Help**
- **Help Button:** Available on every page
- **Tooltips:** Hover over fields for explanations
- **Guided Tours:** Step-by-step feature introductions
- **FAQ Section:** Answers to common questions

### **Training Resources**
- **Video Tutorials:** Step-by-step video guides
- **User Manual:** This comprehensive guide
- **Quick Reference:** Printable cheat sheets
- **Webinars:** Live training sessions

### **Technical Support**
- **Help Desk:** Email support@maternalhealth.com
- **Phone Support:** Call during business hours
- **Live Chat:** Real-time assistance available
- **Ticket System:** Track support requests

### **Community Support**
- **User Forums:** Connect with other users
- **Best Practices:** Share tips and experiences
- **Feature Requests:** Suggest improvements
- **User Groups:** Local user communities

---

## 🔒 **Privacy and Security**

### **Data Protection**
- **Encryption:** All data encrypted in transit and at rest
- **Access Controls:** Role-based access to patient information
- **Audit Trails:** Complete logging of all data access
- **HIPAA Compliance:** Meets healthcare privacy standards

### **User Responsibilities**
- **Strong Passwords:** Use complex, unique passwords
- **Secure Logout:** Always log out when finished
- **Device Security:** Keep devices secure and updated
- **Data Sharing:** Only share information as authorized

### **Privacy Settings**
- **Profile Visibility:** Control who can see your information
- **Communication Preferences:** Choose how you receive notifications
- **Data Sharing:** Opt in/out of research participation
- **Account Deletion:** Request account removal if needed

---

## 📱 **Mobile Usage**

### **Mobile Responsiveness**
The system is fully responsive and works on:
- **Smartphones:** iOS and Android devices
- **Tablets:** iPad and Android tablets
- **Mobile Browsers:** Chrome, Safari, Firefox mobile

### **Mobile-Specific Features**
- **Touch-Friendly:** Large buttons and easy navigation
- **Offline Capability:** Limited offline functionality
- **Push Notifications:** Mobile alerts and reminders
- **Camera Integration:** Photo capture for documentation

### **Mobile Best Practices**
- **Stable Connection:** Ensure good internet connectivity
- **Battery Life:** Keep device charged during assessments
- **Screen Orientation:** Use landscape for data entry
- **Regular Updates:** Keep browser updated

---

## 🎓 **Training and Certification**

### **User Training Levels**

#### **Basic User Training**
- **System Navigation:** How to use the interface
- **Data Entry:** Proper assessment techniques
- **Report Reading:** Understanding system outputs
- **Basic Troubleshooting:** Common issue resolution

#### **Advanced User Training**
- **Clinical Decision Support:** Using AI recommendations
- **Advanced Analytics:** Interpreting complex reports
- **System Administration:** User and configuration management
- **Integration:** Connecting with other systems

### **Certification Program**
- **Online Modules:** Self-paced learning modules
- **Practical Assessments:** Hands-on skill evaluation
- **Continuing Education:** Ongoing training requirements
- **Certification Renewal:** Annual recertification process

---

## 📈 **Best Practices**

### **For All Users**
- **Regular Training:** Stay updated on new features
- **Data Quality:** Enter accurate, complete information
- **Security Awareness:** Follow security protocols
- **Feedback:** Provide suggestions for improvement

### **For CHVs**
- **Consistent Assessments:** Use standardized procedures
- **Timely Data Entry:** Enter data immediately after assessments
- **Patient Communication:** Explain results clearly to patients
- **Follow-Up:** Ensure high-risk patients receive appropriate care

### **For Clinicians**
- **Review AI Recommendations:** Consider but don't blindly follow AI
- **Document Decisions:** Record rationale for treatment choices
- **Monitor Outcomes:** Track patient progress over time
- **Collaborate:** Work closely with CHVs and other providers

### **For Administrators**
- **Regular Monitoring:** Check system performance daily
- **User Support:** Provide timely assistance to users
- **Data Governance:** Ensure data quality and security
- **Continuous Improvement:** Regularly update and enhance system

---

**User Guide Version:** 1.0.0  
**Last Updated:** July 28, 2025  
**For Technical Support:** support@maternalhealth.com