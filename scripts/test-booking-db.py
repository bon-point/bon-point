"""Test atomic booking overlap triggers against an in-memory SQLite engine."""
from pathlib import Path
import sqlite3
import unittest

MIGRATION = Path("cloudflare-v2/migrations/0014_booking_slots_notifications.sql").read_text(encoding="utf-8")

class BookingDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.execute("CREATE TABLE booking_requests (id TEXT PRIMARY KEY, status TEXT NOT NULL, starts_at_utc TEXT, session_type TEXT)")
        self.db.executescript(MIGRATION)

    def insert(self, identifier, at, status="requested", kind="course"):
        self.db.execute("INSERT INTO booking_requests(id,status,starts_at_utc,session_type) VALUES(?,?,?,?)",(identifier,status,at,kind))

    def confirm(self, identifier):
        self.db.execute("UPDATE booking_requests SET status='confirmed' WHERE id=?",(identifier,))

    def test_prevents_conflicts_including_last_five_minutes(self):
        self.insert("first","2026-10-17T10:00:00.000Z")
        self.insert("overlap","2026-10-17T11:05:00.000Z")
        self.confirm("first")
        with self.assertRaisesRegex(sqlite3.IntegrityError,"booking-slot-conflict"):
            self.confirm("overlap")
        self.assertEqual(self.db.execute("SELECT status FROM booking_requests WHERE id='overlap'").fetchone()[0],"requested")

        self.insert("boundary","2026-10-17T11:10:00.000Z")
        self.confirm("boundary")
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM booking_requests WHERE status='confirmed'").fetchone()[0],2)

    def test_pending_requests_may_overlap_but_confirmed_may_not(self):
        self.insert("a","2026-10-17T09:30:00.000Z",kind="intro")
        self.insert("b","2026-10-17T09:45:00.000Z",kind="intro")
        self.confirm("a")
        with self.assertRaisesRegex(sqlite3.IntegrityError,"booking-slot-conflict"):
            self.confirm("b")
        self.insert("c","2026-10-17T10:00:00.000Z",kind="intro")
        self.confirm("c")

    def test_confirmed_insert_and_reschedule_are_guarded(self):
        self.insert("a","2026-10-17T11:00:00.000Z",status="confirmed")
        with self.assertRaisesRegex(sqlite3.IntegrityError,"booking-slot-conflict"):
            self.insert("b","2026-10-17T11:30:00.000Z",status="confirmed")
        self.insert("c","2026-10-17T14:00:00.000Z",status="confirmed")
        with self.assertRaisesRegex(sqlite3.IntegrityError,"booking-slot-conflict"):
            self.db.execute("UPDATE booking_requests SET starts_at_utc='2026-10-17T11:30:00.000Z' WHERE id='c'")
        self.assertEqual(self.db.execute("SELECT starts_at_utc FROM booking_requests WHERE id='c'").fetchone()[0],"2026-10-17T14:00:00.000Z")

    def test_notifications_are_queued_atomically_and_once(self):
        self.insert("a","2026-10-17T11:00:00.000Z")
        self.confirm("a")
        self.assertEqual(sorted(x[0] for x in self.db.execute("SELECT kind FROM booking_mail_jobs WHERE booking_id='a'")),
            ["confirmation_owner","confirmation_parent"])
        self.confirm("a")
        self.assertEqual(self.db.execute("SELECT count(*) FROM booking_mail_jobs WHERE booking_id='a'").fetchone()[0],2)
        self.insert("b","2026-10-17T16:00:00.000Z")
        self.db.execute("UPDATE booking_requests SET status='declined' WHERE id='b'")
        self.assertEqual(self.db.execute("SELECT kind FROM booking_mail_jobs WHERE booking_id='b'").fetchone()[0],"declined_parent")

if __name__=="__main__":
    unittest.main()
