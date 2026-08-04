from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse

from app.auth.login import get_login_url
from app.config import AUTHORITY, CLIENT_ID, REDIRECT_URI


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.get("/login")
def login():

    url = get_login_url()

    return RedirectResponse(url)


@router.get("/microsoft/callback")
def microsoft_callback(request: Request):

    code = request.query_params.get("code")

    if not code:
        return {
            "error": "No authorization code received"
        }

    return {
        "message": "Microsoft login successful",
        "authorization_code": code
    }


@router.get("/admin-consent")
def admin_consent():

    url = (
        f"{AUTHORITY}/adminconsent"
        f"?client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
    )

    return RedirectResponse(url)