import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Eye,
  EyeOff,
  ImagePlus,
  Link2,
  Loader2,
  LockKeyhole,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import Logo from "./Logo";
import {
  addGalleryUrl,
  deleteGalleryImage,
  galleryBackendConfigured,
  getGallerySession,
  listGalleryImages,
  onGalleryAuthChange,
  signInGalleryAdmin,
  signOutGalleryAdmin,
  updateGalleryPublication,
  uploadGalleryFile,
} from "../services/galleryService";

const localPreviewAllowed = import.meta.env.DEV;

export default function GalleryAdminPage() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState({ user: null, isAdmin: false, mode: "supabase" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const canUseLocalPreview = !galleryBackendConfigured && localPreviewAllowed;
  const authorized = session.isAdmin || canUseLocalPreview;

  const loadImages = async () => {
    setLoading(true);
    try {
      setImages(await listGalleryImages({ includeUnpublished: authorized }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsubscribe = () => {};

    if (!galleryBackendConfigured) {
      setSession({ user: null, isAdmin: canUseLocalPreview, mode: canUseLocalPreview ? "local" : "disabled" });
      setLoading(false);
      if (canUseLocalPreview) listGalleryImages({ includeUnpublished: true }).then(setImages).catch(() => {});
      return unsubscribe;
    }

    getGallerySession()
      .then((nextSession) => {
        setSession(nextSession);
        return listGalleryImages({ includeUnpublished: nextSession.isAdmin });
      })
      .then(setImages)
      .catch(() => {})
      .finally(() => setLoading(false));

    unsubscribe = onGalleryAuthChange((nextSession) => {
      setSession(nextSession);
      listGalleryImages({ includeUnpublished: nextSession.isAdmin }).then(setImages).catch(() => {});
    });

    return () => unsubscribe();
  }, [canUseLocalPreview]);

  const login = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const nextSession = await signInGalleryAdmin(email.trim(), password);
      setSession(nextSession);
      setImages(await listGalleryImages({ includeUnpublished: true }));
    } catch (err) {
      setAuthError(err?.message || "Unable to sign in.");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    await signOutGalleryAdmin();
    setSession({ user: null, isAdmin: false, mode: "supabase" });
    setImages(await listGalleryImages({ includeUnpublished: false }));
  };

  return (
    <main className="hidden-admin-page">
      <header className="hidden-admin-header">
        <div className="container hidden-admin-header-inner">
          <Logo />
          <button className="hidden-admin-back" onClick={() => window.location.assign("/")}>
            <ArrowLeft size={17} /> Return to school website
          </button>
        </div>
      </header>

      <section className="hidden-admin-content">
        <div className="container hidden-admin-shell">
          <div className="hidden-admin-title">
            <span className="admin-kicker"><ShieldCheck size={15} /> Private Administration</span>
            <h1>School Picture Gallery</h1>
            <p>This page is intentionally not linked anywhere on the public website.</p>
          </div>

          {!galleryBackendConfigured && !canUseLocalPreview ? (
            <div className="admin-panel admin-panel-standalone">
              <div className="gallery-alert gallery-alert-error">
                <strong>Gallery administration is disabled.</strong>
                <span>Connect Supabase before using the admin area on a deployed website.</span>
              </div>
            </div>
          ) : galleryBackendConfigured && !session.isAdmin ? (
            <div className="admin-panel admin-panel-standalone admin-login-shell">
              <form className="admin-login" onSubmit={login}>
                <div className="admin-lock"><LockKeyhole size={26} /></div>
                <h4>Administrator sign in</h4>
                <p>Only authorized EL Hedaya administrators can manage school pictures.</p>
                <label className="gallery-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
                <label className="gallery-field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
                {authError && <div className="gallery-alert gallery-alert-error">{authError}</div>}
                <button className="button button-green" type="submit" disabled={authLoading}>
                  {authLoading ? <Loader2 className="spin" size={18} /> : <LockKeyhole size={17} />}
                  {authLoading ? "Signing in…" : "Sign In"}
                </button>
              </form>
            </div>
          ) : (
            <GalleryWorkspace images={images} loading={loading} session={session} localPreview={canUseLocalPreview} onRefresh={loadImages} onLogout={logout} />
          )}
        </div>
      </section>
    </main>
  );
}

function GalleryWorkspace({ images, loading, session, localPreview, onRefresh, onLogout }) {
  const [mode, setMode] = useState("upload");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [publishNow, setPublishNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [deleteId, setDeleteId] = useState("");
  const [visibilityId, setVisibilityId] = useState("");

  const previewUrl = useMemo(() => {
    if (mode === "url") return url.trim();
    if (!file) return "";
    return URL.createObjectURL(file);
  }, [mode, url, file]);

  useEffect(() => () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const addPhoto = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const payload = { title, caption, isPublished: publishNow };
      if (mode === "upload") await uploadGalleryFile({ ...payload, file });
      else await addGalleryUrl({ ...payload, url });
      setTitle(""); setCaption(""); setUrl(""); setFile(null); setPublishNow(true);
      setMessage({ type: "success", text: publishNow ? "Photo added and published." : "Photo added as hidden." });
      await onRefresh();
    } catch (err) {
      setMessage({ type: "error", text: err?.message || "The photo could not be added." });
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async (item) => {
    setVisibilityId(item.id);
    setMessage({ type: "", text: "" });
    try {
      const nextPublished = !item.is_published;
      await updateGalleryPublication(item, nextPublished);
      setMessage({ type: "success", text: nextPublished ? "Photo published." : "Photo hidden from visitors." });
      await onRefresh();
    } catch (err) {
      setMessage({ type: "error", text: err?.message || "Visibility could not be changed." });
    } finally {
      setVisibilityId("");
    }
  };

  const remove = async (item) => {
    if (!window.confirm("Delete this photo from the gallery?")) return;
    setDeleteId(item.id);
    setMessage({ type: "", text: "" });
    try {
      await deleteGalleryImage(item);
      setMessage({ type: "success", text: "Photo deleted." });
      await onRefresh();
    } catch (err) {
      setMessage({ type: "error", text: err?.message || "The photo could not be deleted." });
    } finally {
      setDeleteId("");
    }
  };

  const publishedCount = images.filter((item) => item.is_published !== false).length;
  const hiddenCount = images.length - publishedCount;

  return (
    <div className="admin-panel admin-panel-standalone">
      {localPreview && (
        <div className="gallery-alert gallery-alert-demo">
          <strong>Local development preview</strong>
          <span>These test photos are stored only in this browser. Production administration requires Supabase.</span>
        </div>
      )}

      <div className="admin-workspace">
        <div className="admin-toolbar">
          <div>
            <strong>{localPreview ? "Local preview administrator" : session.user?.email}</strong>
            <span>{publishedCount} published · {hiddenCount} hidden</span>
          </div>
          {!localPreview && <button className="admin-logout" onClick={onLogout}><LogOut size={16} /> Sign out</button>}
        </div>

        <div className="admin-columns">
          <form className="add-photo-card" onSubmit={addPhoto}>
            <div className="add-photo-title">
              <div className="add-photo-icon"><ImagePlus size={22} /></div>
              <div><span>Add to gallery</span><strong>New school picture</strong></div>
            </div>

            <div className="source-tabs" role="tablist" aria-label="Photo source">
              <button type="button" className={mode === "upload" ? "active" : ""} onClick={() => setMode("upload")}><Upload size={16} /> Upload File</button>
              <button type="button" className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}><Link2 size={16} /> Image URL</button>
            </div>

            {mode === "upload" ? (
              <label className="upload-dropzone">
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <Upload size={23} /><strong>{file ? file.name : "Choose a picture"}</strong><span>JPG, PNG, WEBP or GIF · up to 10 MB</span>
              </label>
            ) : (
              <label className="gallery-field"><span>Direct image URL</span><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/school-photo.jpg" required /></label>
            )}

            {previewUrl && <div className="admin-image-preview"><img src={previewUrl} alt="New gallery preview" /></div>}
            <label className="gallery-field"><span>Title <small>optional</small></span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quran Class" maxLength="80" /></label>
            <label className="gallery-field"><span>Caption <small>optional</small></span><textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="A short description of this moment…" rows="3" maxLength="240" /></label>

            <label className="publish-switch-row">
              <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
              <span className="publish-switch" aria-hidden="true"><span /></span>
              <span><strong>Publish immediately</strong><small>Turn this off to save the photo hidden until you are ready.</small></span>
            </label>

            {message.text && <div className={`gallery-alert gallery-alert-${message.type}`}>{message.text}</div>}
            <button className="button button-gold add-photo-submit" type="submit" disabled={saving || (mode === "upload" ? !file : !url.trim())}>
              {saving ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}{saving ? "Adding Photo…" : publishNow ? "Add & Publish" : "Save Hidden Photo"}
            </button>
          </form>

          <div className="manage-photo-card">
            <div className="manage-photo-heading"><div><span>Current gallery</span><strong>Manage visibility & pictures</strong></div><span className="photo-count">{images.length}</span></div>
            {loading ? (
              <div className="admin-empty-list"><Loader2 className="spin" size={24} /><span>Loading pictures…</span></div>
            ) : images.length === 0 ? (
              <div className="admin-empty-list"><Camera size={24} /><span>No pictures yet.</span></div>
            ) : (
              <div className="admin-photo-list">
                {images.map((item) => (
                  <div className={`admin-photo-row ${item.is_published === false ? "is-hidden" : ""}`} key={item.id}>
                    <img src={item.image_url} alt={item.title || "Gallery thumbnail"} />
                    <div>
                      <strong>{item.title || "Untitled photo"}</strong>
                      <span className={`photo-status ${item.is_published === false ? "hidden" : "published"}`}>
                        {item.is_published === false ? <><EyeOff size={12} /> Hidden</> : <><Eye size={12} /> Published</>}
                        <i>·</i> {item.source_type === "url" ? "Image URL" : "Uploaded file"}
                      </span>
                    </div>
                    <div className="admin-photo-actions">
                      <button className="visibility-photo" onClick={() => toggleVisibility(item)} disabled={visibilityId === item.id} aria-label={item.is_published === false ? "Publish photo" : "Hide photo"}>
                        {visibilityId === item.id ? <Loader2 className="spin" size={17} /> : item.is_published === false ? <Eye size={17} /> : <EyeOff size={17} />}
                      </button>
                      <button className="delete-photo" onClick={() => remove(item)} disabled={deleteId === item.id} aria-label={`Delete ${item.title || "photo"}`}>
                        {deleteId === item.id ? <Loader2 className="spin" size={17} /> : <Trash2 size={17} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
