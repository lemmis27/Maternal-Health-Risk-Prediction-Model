import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models_db import Base
import os
import tempfile
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# To avoid import errors, always run pytest with PYTHONPATH=.
# Example: set PYTHONPATH=. && pytest ...
try:
    from app import app, get_db
except ModuleNotFoundError as e:
    raise ImportError(
        "Could not import 'app' module. Make sure to run pytest with PYTHONPATH set to the project root. "
        "Example: set PYTHONPATH=. && pytest ...\nOriginal error: " + str(e)
    )

@pytest.fixture(scope="session")
def db_url():
    # Create a temporary file for the SQLite database
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    url = f"sqlite:///{db_path}"
    yield url
    os.close(db_fd)
    os.unlink(db_path)

@pytest.fixture(scope="session")
def engine(db_url):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()

@pytest.fixture(scope="function")
def db_session(engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="function")
def client(db_session):
    # Override get_db to use the test session
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c 