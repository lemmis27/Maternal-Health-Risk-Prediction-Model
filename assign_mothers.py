from app import get_db
from models_db import PregnantMother
import uuid

def assign_mothers_to_clinician():
    db = next(get_db())
    clinician_id = 'b7b28a31-9a4c-41fe-9e53-e9a03b794e38'
    mother_ids = ['M801CCB39', 'M164DD034']
    for mid in mother_ids:
        mother = db.query(PregnantMother).filter_by(id=mid).first()
        if mother:
            mother.assigned_clinician_id = clinician_id
            db.add(mother)
            print(f'Assigning {mid} to {clinician_id}')
    db.commit()
    print('Assignment complete.')

def create_default_assessments_for_all_patients():
    from database import SessionLocal
    from models_db import PregnantMother, RiskAssessment
    from datetime import datetime
    session = SessionLocal()
    try:
        mothers = session.query(PregnantMother).all()
        count = 0
        for mother in mothers:
            has_assessment = session.query(RiskAssessment).filter_by(mother_id=mother.id).first()
            if not has_assessment:
                # Use safe/typical values for a default assessment
                assessment = RiskAssessment(
                    id=str(uuid.uuid4()),
                    mother_id=mother.id,
                    chv_id=None,
                    assessment_date=datetime.now(),
                    age=mother.age or 25,
                    systolic_bp=120.0,
                    diastolic_bp=80.0,
                    blood_sugar=8.0,
                    body_temp=98.6,
                    heart_rate=72,
                    gestational_age=mother.gestational_age or 20,
                    weight=65.0,
                    height=165.0,
                    symptoms='',
                    notes='Auto-generated initial assessment.',
                    bmi=65.0 / ((165.0 / 100) ** 2),
                    risk_level='low',
                    risk_score=0.1,
                    confidence=0.9,
                    recommendations='Initial checkup recommended.'
                )
                session.add(assessment)
                print(f'Created default assessment for mother {mother.id}')
                count += 1
        session.commit()
        print(f'Total default assessments created: {count}')
    finally:
        session.close()

if __name__ == "__main__":
    assign_mothers_to_clinician()
    create_default_assessments_for_all_patients() 