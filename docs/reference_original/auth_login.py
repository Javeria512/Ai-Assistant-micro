from msal import ConfidentialClientApplication
from app.config import CLIENT_ID, CLIENT_SECRET, AUTHORITY, REDIRECT_URI, SCOPES


msal_app = ConfidentialClientApplication(
    client_id=CLIENT_ID,
    client_credential=CLIENT_SECRET,
    authority=AUTHORITY
)


def get_login_url():

    login_url = msal_app.get_authorization_request_url(
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

    return login_url