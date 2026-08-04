from dotenv import load_dotenv
import os

load_dotenv()


CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
TENANT_ID = os.getenv("TENANT_ID")
REDIRECT_URI = os.getenv("REDIRECT_URI")


AUTHORITY = "https://login.microsoftonline.com/common"

SCOPES = [
    "User.Read",
    "Mail.Read",
    "Calendars.Read",
    "Tasks.Read"
]