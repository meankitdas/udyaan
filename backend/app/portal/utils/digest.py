"""Digest email rendering.

One email summarising everything that happened, rather than one per event.
Every send carries a one-click unsubscribe link, which is both required by
bulk-sender rules and the thing that stops recipients marking the mail as spam
(which is what actually damages a domain's sending reputation).
"""

from typing import Dict, List, Sequence, Tuple

from app.portal.config import settings
from app.portal.models.notification import Notification, NotificationKind

_HEADINGS = {
    NotificationKind.CONNECTION_REQUEST: "New connection requests",
    NotificationKind.MESSAGE: "New messages",
    NotificationKind.POST: "New posts from your network",
}

_LINKS = {
    NotificationKind.CONNECTION_REQUEST: "/portal/community/requests",
    NotificationKind.MESSAGE: "/portal/community/messages",
    NotificationKind.POST: "/portal/community",
}


def _group(
    notifications: Sequence[Notification],
) -> Dict[str, List[Notification]]:
    grouped: Dict[str, List[Notification]] = {}
    for item in notifications:
        grouped.setdefault(item.kind, []).append(item)
    return grouped


def _line(kind: str, items: Sequence[Notification], names: Dict[str, str]) -> str:
    who = [names.get(i.actor_id or "", "Someone") for i in items]
    unique = list(dict.fromkeys(who))
    if len(unique) == 1:
        subject = unique[0]
    elif len(unique) == 2:
        subject = f"{unique[0]} and {unique[1]}"
    else:
        subject = f"{unique[0]}, {unique[1]} and {len(unique) - 2} others"

    if kind == NotificationKind.CONNECTION_REQUEST:
        return f"{subject} want{'s' if len(unique) == 1 else ''} to connect with you."
    if kind == NotificationKind.MESSAGE:
        return f"{subject} sent you {'a message' if len(items) == 1 else f'{len(items)} messages'}."
    return f"{subject} shared {'a new post' if len(items) == 1 else 'new posts'}."


def subject_for(notifications: Sequence[Notification], names: Dict[str, str]) -> str:
    grouped = _group(notifications)
    if len(grouped) == 1:
        kind, items = next(iter(grouped.items()))
        return _line(kind, items, names)
    return f"You have {len(notifications)} new notifications on Udyaan"


def render(
    full_name: str,
    user_id: str,
    notifications: Sequence[Notification],
    names: Dict[str, str],
    unsubscribe_url: str,
) -> Tuple[str, str, str]:
    """Return ``(subject, plain_text, html)`` for one member's digest."""
    grouped = _group(notifications)
    base = settings.FRONTEND_URL.rstrip("/")
    subject = subject_for(notifications, names)

    sections_text: List[str] = []
    sections_html: List[str] = []
    for kind, items in grouped.items():
        heading = _HEADINGS.get(kind, "Updates")
        line = _line(kind, items, names)
        url = f"{base}{_LINKS.get(kind, '/portal/community')}"
        sections_text.append(f"{heading}\n{line}\n{url}")
        sections_html.append(
            f"""
            <div style="margin:0 0 22px 0;padding:16px;border:1px solid #e6e8e6;border-radius:10px;">
              <p style="margin:0 0 6px 0;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;">{heading}</p>
              <p style="margin:0 0 12px 0;font-size:15px;color:#111827;">{line}</p>
              <a href="{url}" style="display:inline-block;background:#1f7a44;color:#ffffff;
                 padding:9px 18px;border-radius:6px;text-decoration:none;font-size:14px;">View</a>
            </div>
            """
        )

    greeting = full_name.split(" ")[0] if full_name else "there"

    text = (
        f"Hi {greeting},\n\nHere is what you missed on Udyaan.\n\n"
        + "\n\n".join(sections_text)
        + f"\n\n---\nStop receiving these emails: {unsubscribe_url}\n"
    )

    html = f"""
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:24px;background:#f6f7f6;font-family:'Segoe UI',Tahoma,sans-serif;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
          <p style="margin:0 0 4px 0;font-size:20px;font-weight:700;color:#1f7a44;">Udyaan</p>
          <p style="margin:0 0 22px 0;font-size:15px;color:#374151;">Hi {greeting}, here is what you missed.</p>
          {''.join(sections_html)}
          <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af;border-top:1px solid #eee;padding-top:16px;">
            You are receiving this because you have an account on Udyaan.
            <a href="{unsubscribe_url}" style="color:#6b7280;">Unsubscribe from these emails</a>.
          </p>
        </div>
      </body>
    </html>
    """

    return subject, text, html
