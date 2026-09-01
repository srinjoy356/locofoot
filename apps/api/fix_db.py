import psycopg2
conn = psycopg2.connect('postgresql://postgres.lcxgjwdffkexrrnfcuik:l23cTAS01Y9iHZSF@aws-0-ap-south-1.pooler.supabase.com:5432/postgres')
cur = conn.cursor()
with open(r'C:\dev\locofoot\supabase\migrations\0057_phase5d_granular_analytics.sql', 'r', encoding='utf-8') as f:
    sql = f.read()
cur.execute(sql)
conn.commit()
print('DONE')
