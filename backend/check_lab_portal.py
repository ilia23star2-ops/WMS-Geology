"""
Расширенный device-check пачки 2.x-lab-portal-bundle-1.

Запуск: poetry run python check_lab_portal.py
Требует: runserver на http://127.0.0.1:8000.

Создаёт в dev-БД объекты с уникальными именами (CHK-<TS>), не удаляет.
Покрывает:
- JWT role для 6 типов пользователей;
- can_mark_received для 6 юзеров × 4 рейсов (18 проверок);
- POST mark-received: own/repeat/other/cancelled/received/lost/draft/assembled/inbound/no-auth (10);
- current_holder Container: 6 статусов + без лаборатории (8);
- current_holder Sample: 4 статуса (4).
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "wms_geology.settings")
import django  # noqa: E402
django.setup()

from django.contrib.auth.models import User  # noqa: E402

from apps.picking.models import Shipment, ShipmentContainerItem  # noqa: E402
from apps.samples.catalogs import Laboratory, ResearchType  # noqa: E402
from apps.samples.models import Sample  # noqa: E402
from apps.storage.models import Container, ContainerType  # noqa: E402
from apps.users.models import Role, UserProfile  # noqa: E402

BASE = "http://127.0.0.1:8000"
TS = datetime.now().strftime("%H%M%S")
PASSWORD = "check123"
results = []


def http(method, path, token=None, body=None):
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode("utf-8"))
        except Exception:
            body = {}
        return e.code, body


def check(name, cond, detail=""):
    results.append((name, cond))
    status = "PASS" if cond else "FAIL"
    line = status + "  " + name
    if detail:
        line += "  [" + str(detail) + "]"
    print(line)


# ============================================================
# Stage 1: setup
# ============================================================
print("=== Stage 1: setup (dev DB) ===")
lab_a, _ = Laboratory.objects.get_or_create(
    code="CHK-A-" + TS, defaults={"name": "Чек Лаб А"}
)
lab_b, _ = Laboratory.objects.get_or_create(
    code="CHK-B-" + TS, defaults={"name": "Чек Лаб Б"}
)
role_ad, _ = Role.objects.get_or_create(name="admin")
role_mg, _ = Role.objects.get_or_create(name="manager")
role_wk, _ = Role.objects.get_or_create(name="worker")
role_lw, _ = Role.objects.get_or_create(
    name="lab_worker", defaults={"description": "Сотрудник лаборатории"}
)


def ensure_user(username, role, lab=None, no_profile=False):
    u, created = User.objects.get_or_create(username=username)
    if created:
        u.set_password(PASSWORD)
        u.save()
    if no_profile:
        UserProfile.objects.filter(user=u).delete()
    else:
        UserProfile.objects.update_or_create(
            user=u, defaults={"role": role, "laboratory": lab}
        )
    return u


admin_user = ensure_user("chk_admin_" + TS, role_ad)
manager_user = ensure_user("chk_mgr_" + TS, role_mg)
lab_a_user = ensure_user("chk_lab_a_" + TS, role_lw, lab_a)
lab_b_user = ensure_user("chk_lab_b_" + TS, role_lw, lab_b)
lab_none_user = ensure_user("chk_lab_none_" + TS, role_lw, None)
worker_user = ensure_user("chk_worker_" + TS, role_wk, None)
noprof_user = ensure_user("chk_noprof_" + TS, None, no_profile=True)


def mk_shipment(num, status, lab=None, direction="OUTBOUND"):
    return Shipment.objects.create(
        shipment_number="ОТ-CHK-" + num + "-" + TS,
        direction=direction,
        laboratory=lab,
        status=status,
        sent_at=datetime.now() if status == Shipment.STATUS_SENT else None,
    )


sh_a_sent = mk_shipment("A-SENT", Shipment.STATUS_SENT, lab_a)
sh_a_draft = mk_shipment("A-DRAFT", Shipment.STATUS_DRAFT, lab_a)
sh_a_assembled = mk_shipment("A-ASM", Shipment.STATUS_ASSEMBLED, lab_a)
sh_b_sent = mk_shipment("B-SENT", Shipment.STATUS_SENT, lab_b)
sh_a_cancelled = mk_shipment("A-CAN", Shipment.STATUS_CANCELLED, lab_a)
sh_a_received = mk_shipment("A-RCV", Shipment.STATUS_RECEIVED, lab_a)
sh_a_lost = mk_shipment("A-LOST", Shipment.STATUS_LOST, lab_a)
sh_a_inbound = mk_shipment(
    "A-INB", Shipment.STATUS_SENT, lab_a, direction="INBOUND"
)

ct, _ = ContainerType.objects.get_or_create(
    name="Чек Ящик " + TS, defaults={"size_class": "M"}
)


def mk_container(num, status):
    return Container.objects.create(
        container_type=ct,
        container_number="CHK-" + num + "-" + TS,
        status=status,
    )


c_pending_f = mk_container("PF", Container.STATUS_PENDING_FILLING)
c_pending_p = mk_container("PP", Container.STATUS_PENDING_PLACEMENT)
c_active = mk_container("ACT", Container.STATUS_ACTIVE)
c_transit_lab = mk_container("TRL", Container.STATUS_IN_TRANSIT)
c_transit_no = mk_container("TRN", Container.STATUS_IN_TRANSIT)
c_issued_lab = mk_container("ISL", Container.STATUS_ISSUED)
c_issued_no = mk_container("ISN", Container.STATUS_ISSUED)
c_disposed = mk_container("DIS", Container.STATUS_DISPOSED)

ShipmentContainerItem.objects.create(shipment=sh_a_sent, container=c_transit_lab)
ShipmentContainerItem.objects.create(shipment=sh_a_sent, container=c_issued_lab)

rt, _ = ResearchType.objects.get_or_create(code="ЧК-" + TS, name="Чек ТИ")
s_active = Sample.objects.create(
    sample_number="CHK-S-ACT-" + TS, research_type=rt, container=c_active
)
s_transit = Sample.objects.create(
    sample_number="CHK-S-TR-" + TS, research_type=rt, container=c_transit_lab
)
s_issued = Sample.objects.create(
    sample_number="CHK-S-IS-" + TS, research_type=rt, container=c_issued_lab
)
s_disposed = Sample.objects.create(
    sample_number="CHK-S-DIS-" + TS, research_type=rt, container=c_disposed
)

print("  Users: admin,mgr,lab_a,lab_b,lab_none,worker,noprof")
print("  Shipments: " + str(sh_a_sent.id) + "," + str(sh_a_draft.id)
      + "," + str(sh_a_assembled.id) + "," + str(sh_b_sent.id)
      + "," + str(sh_a_cancelled.id) + "," + str(sh_a_received.id)
      + "," + str(sh_a_lost.id) + "," + str(sh_a_inbound.id))
print("  Containers: " + str(c_active.id) + "," + str(c_issued_lab.id))

# ============================================================
# Stage 2: JWT
# ============================================================
print("=== Stage 2: JWT (login) ===")


def login(username):
    code, body = http(
        "POST", "/api/v1/auth/login/",
        body={"username": username, "password": PASSWORD},
    )
    if code != 200:
        print("FAIL  login " + username + " -> " + str(code) + " " + str(body))
        return None, None
    return body["access"], body.get("role")


tokens = {}
for label, u, expected_role in [
    ("admin", admin_user, "admin"),
    ("mgr", manager_user, "manager"),
    ("lab_a", lab_a_user, "lab_worker"),
    ("lab_b", lab_b_user, "lab_worker"),
    ("lab_none", lab_none_user, "lab_worker"),
    ("worker", worker_user, "worker"),
]:
    tok, role = login(u.username)
    tokens[label] = tok
    check("JWT role=" + expected_role + " (" + label + ")", role == expected_role, role)

# user без профиля — login должен вернуть role=None
tok, role = login(noprof_user.username)
tokens["noprof"] = tok
check("JWT role=None (noprof)", role in (None, ""), role)

# ============================================================
# Stage 3: can_mark_received
# ============================================================
print("=== Stage 3: can_mark_received ===")


def get_cmr(shipment_id, token):
    code, body = http("GET", "/api/v1/shipments/" + str(shipment_id) + "/", token)
    return body.get("can_mark_received")


# admin
check("admin: A-SENT=True", get_cmr(sh_a_sent.id, tokens["admin"]) is True)
check("admin: B-SENT=True", get_cmr(sh_b_sent.id, tokens["admin"]) is True)
check("admin: A-DRAFT=True", get_cmr(sh_a_draft.id, tokens["admin"]) is True)
check("admin: A-RECEIVED=False", get_cmr(sh_a_received.id, tokens["admin"]) is False)
check("admin: A-CANCELLED=False", get_cmr(sh_a_cancelled.id, tokens["admin"]) is False)
check("admin: A-LOST=False", get_cmr(sh_a_lost.id, tokens["admin"]) is False)

# manager (тоже is_admin)
check("mgr: B-SENT=True", get_cmr(sh_b_sent.id, tokens["mgr"]) is True)

# lab_a — свой=True, чужой=False
check("lab_a: A-SENT=True", get_cmr(sh_a_sent.id, tokens["lab_a"]) is True)
check("lab_a: B-SENT=False", get_cmr(sh_b_sent.id, tokens["lab_a"]) is False)
check("lab_a: A-INBOUND=True", get_cmr(sh_a_inbound.id, tokens["lab_a"]) is True)
check("lab_a: A-RECEIVED=False", get_cmr(sh_a_received.id, tokens["lab_a"]) is False)

# lab_b
check("lab_b: B-SENT=True", get_cmr(sh_b_sent.id, tokens["lab_b"]) is True)
check("lab_b: A-SENT=False", get_cmr(sh_a_sent.id, tokens["lab_b"]) is False)

# lab_none (lab_worker без лаборатории)
check("lab_none: A-SENT=False", get_cmr(sh_a_sent.id, tokens["lab_none"]) is False)

# worker (не admin, нет лаборатории)
check("worker: A-SENT=False", get_cmr(sh_a_sent.id, tokens["worker"]) is False)

# noprof (без профиля)
check("noprof: A-SENT=False", get_cmr(sh_a_sent.id, tokens["noprof"]) is False)

# ============================================================
# Stage 4: POST mark-received
# ============================================================
print("=== Stage 4: mark-received ===")


def post_mr(shipment_id, token):
    return http(
        "POST",
        "/api/v1/shipments/" + str(shipment_id) + "/mark-received/",
        token,
    )

# own SENT → 200
code, body = post_mr(sh_a_sent.id, tokens["lab_a"])
check("lab_a: mark own SENT -> 200", code == 200, code)
check("status=RECEIVED", body.get("status") == "RECEIVED", body.get("status"))
check("received_at set", body.get("received_at") is not None)

# repeat → 400
code, _ = post_mr(sh_a_sent.id, tokens["lab_a"])
check("lab_a: repeat -> 400", code == 400, code)

# other → 403
code, _ = post_mr(sh_b_sent.id, tokens["lab_a"])
check("lab_a: other -> 403", code == 403, code)

# CANCELLED → 400
code, _ = post_mr(sh_a_cancelled.id, tokens["admin"])
check("admin: CANCELLED -> 400", code == 400, code)

# LOST → 400
code, _ = post_mr(sh_a_lost.id, tokens["admin"])
check("admin: LOST -> 400", code == 400, code)

# DRAFT → 200
code, _ = post_mr(sh_a_draft.id, tokens["admin"])
check("admin: DRAFT -> 200", code == 200, code)

# ASSEMBLED → 200
code, _ = post_mr(sh_a_assembled.id, tokens["admin"])
check("admin: ASSEMBLED -> 200", code == 200, code)

# INBOUND (lab_a) → 200
code, _ = post_mr(sh_a_inbound.id, tokens["lab_a"])
check("lab_a: INBOUND -> 200", code == 200, code)

# no auth → 401
code, _ = http(
    "POST", "/api/v1/shipments/" + str(sh_b_sent.id) + "/mark-received/"
)
check("no-auth: -> 401", code == 401, code)

# ============================================================
# Stage 5: current_holder Container
# ============================================================
print("=== Stage 5: current_holder Container ===")


def get_ch_container(cid, token):
    code, body = http("GET", "/api/v1/storage/containers/" + str(cid) + "/?show_disposed=true", token)
    return body.get("current_holder")

ch = get_ch_container(c_pending_f.id, tokens["admin"])
check("PENDING_FILLING -> 'У нас на складе'", ch == "У нас на складе", ch)

ch = get_ch_container(c_pending_p.id, tokens["admin"])
check("PENDING_PLACEMENT -> 'У нас на складе'", ch == "У нас на складе", ch)

ch = get_ch_container(c_active.id, tokens["admin"])
check("ACTIVE -> 'У нас на складе'", ch == "У нас на складе", ch)

ch = get_ch_container(c_transit_lab.id, tokens["admin"])
check("IN_TRANSIT with lab -> 'В пути к Чек Лаб А'",
      ch == "В пути к Чек Лаб А", ch)

ch = get_ch_container(c_transit_no.id, tokens["admin"])
check("IN_TRANSIT no lab -> 'В пути'", ch == "В пути", ch)

ch = get_ch_container(c_issued_lab.id, tokens["admin"])
check("ISSUED with lab -> 'У лаборатории Чек Лаб А'",
      ch == "У лаборатории Чек Лаб А", ch)

ch = get_ch_container(c_issued_no.id, tokens["admin"])
check("ISSUED no lab -> 'У лаборатории'", ch == "У лаборатории", ch)

ch = get_ch_container(c_disposed.id, tokens["admin"])
check("DISPOSED -> 'Утилизирована'", ch == "Утилизирована", ch)

# ============================================================
# Stage 6: current_holder Sample
# ============================================================
print("=== Stage 6: current_holder Sample ===")


def get_ch_sample(sid, token):
    code, body = http("GET", "/api/v1/samples/" + str(sid) + "/?show_disposed=true", token)
    return body.get("current_holder")

ch = get_ch_sample(s_active.id, tokens["admin"])
check("Sample in ACTIVE -> 'У нас на складе'", ch == "У нас на складе", ch)

ch = get_ch_sample(s_transit.id, tokens["admin"])
check("Sample in IN_TRANSIT -> 'В пути к Чек Лаб А'",
      ch == "В пути к Чек Лаб А", ch)

ch = get_ch_sample(s_issued.id, tokens["admin"])
check("Sample in ISSUED -> 'У лаборатории Чек Лаб А'",
      ch == "У лаборатории Чек Лаб А", ch)

ch = get_ch_sample(s_disposed.id, tokens["admin"])
check("Sample in DISPOSED -> 'Утилизирована'", ch == "Утилизирована", ch)

# ============================================================
# Итог
# ============================================================
passed = sum(1 for _, c in results if c)
failed = sum(1 for _, c in results if not c)
print("")
print("===== DEVICE-CHECK: " + str(passed) + " PASS, " + str(failed) + " FAIL =====")
if failed:
    print("")
    print("FAILED:")
    for name, cond in results:
        if not cond:
            print("  - " + name)
    print("")
    print("CLEANUP:")
    print("  cd backend")
    print("  poetry run python manage.py shell")
    print("  >>> from apps.picking.models import Shipment")
    print("  >>> from apps.storage.models import Container, ContainerType")
    print("  >>> from apps.samples.models import Sample")
    print("  >>> from apps.samples.catalogs import Laboratory")
    print("  >>> from django.contrib.auth.models import User")
    print("  >>> User.objects.filter(username__startswith='chk_').delete()")
    print("  >>> Sample.objects.filter(sample_number__startswith='CHK-').delete()")
    print("  >>> Shipment.objects.filter(shipment_number__startswith='ОТ-CHK-').delete()")
    print("  >>> Container.objects.filter(container_number__startswith='CHK-').delete()")
    print("  >>> ContainerType.objects.filter(name__startswith='Чек Ящик').delete()")
    print("  >>> Laboratory.objects.filter(code__startswith='CHK-').delete()")
    sys.exit(1)
else:
    print("")
    print("CLEANUP (опционально):")
    print("  те же команды, что выше (см. блок в ответе ИИ)")