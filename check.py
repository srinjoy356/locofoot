import psycopg2  
conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres')  
cur = conn.cursor()  
cur.execute('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'notifications\';')  
print(cur.fetchall())  
