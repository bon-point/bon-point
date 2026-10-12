-- Notifier le parent de l'annulation d'un créneau déjà confirmé,
-- ou du refus d'une proposition initiale (même mécanisme sécurisé).
DROP TRIGGER IF EXISTS booking_declined_queue_mail;
CREATE TRIGGER booking_declined_queue_mail
AFTER UPDATE OF status ON booking_requests
WHEN NEW.status='declined' AND OLD.status<>'declined'
BEGIN
 INSERT OR IGNORE INTO booking_mail_jobs(booking_id,kind) VALUES(NEW.id,'declined_parent');
END;
