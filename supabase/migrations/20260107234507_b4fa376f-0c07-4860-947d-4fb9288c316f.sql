-- Criar bucket para fotos dos seguranças
INSERT INTO storage.buckets (id, name, public)
VALUES ('guard-photos', 'guard-photos', true);

-- Política para permitir admins fazerem upload
CREATE POLICY "Admins can upload guard photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'guard-photos' AND
  (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin')
  )
);

-- Política para permitir leitura pública
CREATE POLICY "Public can view guard photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'guard-photos');

-- Política para admins deletarem fotos
CREATE POLICY "Admins can delete guard photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'guard-photos' AND
  (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin')
  )
);

-- Política para admins atualizarem fotos
CREATE POLICY "Admins can update guard photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'guard-photos' AND
  (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin')
  )
);