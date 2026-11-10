"""Read-only API example. Python standard library; no tokens printed or stored."""
import json
import os
import sys
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    token = os.environ.get("ORCH_ACCESS_TOKEN", "")
    if not token or len(token) > 20000 or "\r" in token or "\n" in token:
        raise ValueError("Supply ORCH_ACCESS_TOKEN through your protected application environment.")
    request = urllib.request.Request(
        "https://api.orchesphere.ai/v1/workspaces",
        headers={"Authorization": "Bearer " + token, "Accept": "application/json"},
    )
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=20) as response:
            body = response.read(1048577)
            if len(body) > 1048576:
                raise ValueError("The workspace response exceeds the expected bound.")
            result = json.loads(body)
            if not isinstance(result.get("workspaces"), list):
                raise ValueError("Unexpected workspace response.")
            print(f"Received {len(result['workspaces'])} workspaces.")
    except urllib.error.HTTPError as error:
        raise ValueError(f"Workspace request failed (HTTP {error.code}). Check current authorization.") from None
    except (urllib.error.URLError, TimeoutError):
        raise ValueError("The workspace request could not complete.") from None


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
