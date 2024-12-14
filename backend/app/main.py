from fastapi import FastAPI
from app.database.connection import create_connection

app = FastAPI()

app.get("/")
def read_root():
    return {"message": "Hello World!"}