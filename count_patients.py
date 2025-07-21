from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from models_db import PregnantMother
from config import SQLALCHEMY_DATABASE_URL

# Use the same engine setup as the main app
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

if __name__ == "__main__":
    session = SessionLocal()
    try:
        count = session.query(PregnantMother).count()
        print(f"Number of patients in the database: {count}")
    finally:
        session.close() 