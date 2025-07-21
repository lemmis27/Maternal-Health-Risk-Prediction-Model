from sqlalchemy import create_engine, inspect, text

# Update the path if your DB is elsewhere
engine = create_engine('sqlite:///maternal_health.db')
inspector = inspect(engine)

print('Tables in the database:')
tables = inspector.get_table_names()
print(tables)

if 'alembic_version' in tables:
    print('\nContents of alembic_version table:')
    with engine.connect() as conn:
        result = conn.execute(text('SELECT * FROM alembic_version'))
        for row in result:
            print(row)
else:
    print("\nTable 'alembic_version' does not exist in this database.") 