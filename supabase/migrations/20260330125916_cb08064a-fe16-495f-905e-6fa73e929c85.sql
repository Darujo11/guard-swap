
ALTER TABLE leaves ADD COLUMN document_url text;

INSERT INTO storage.buckets (id, name, public) VALUES ('leave-documents', 'leave-documents', true);

CREATE POLICY "Admins can upload leave documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'leave-documents' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Anyone authenticated can view leave documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'leave-documents');

CREATE POLICY "Admins can delete leave documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'leave-documents' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin')));
