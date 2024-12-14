import mysql.connector
from mysql.connector import Error

def create_connection():
    try:
        connection = mysql.connector.connect(
            user="root",
            password="",
            host="127.0.0.1",
            database="dsa"
        )
        if connection.is_connected():
            print("Connected to MySQL database")
        return connection
    except Error as e:
        print("Error while connecting to MySQL", e)
        return None