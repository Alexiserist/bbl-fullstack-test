# BBL Full-Stack Developer Test

TODO: Add setup, run, test, and completed-versus-skipped documentation as the project is implemented.

Current status: repository structure only; no application code has been implemented.

## Authentication decision

The backend accepts only an Auth0 access token issued for the API audience as its Bearer credential, because access tokens are audience-bound credentials intended for APIs while ID tokens are intended for the client application and must not authorize API access.
