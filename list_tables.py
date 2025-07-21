import sqlite3
conn = sqlite3.connect('maternal_health.db')
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
print("Tables in maternal_health.db:", tables)
conn.close() 