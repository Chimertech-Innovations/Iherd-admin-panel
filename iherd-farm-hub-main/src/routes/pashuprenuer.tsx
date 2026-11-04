import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GraduationCap,
  Plus,
  Search,
  Video,
  PlaySquare,
  ExternalLink,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Power,
  Tv,
  ListOrdered,
  Sparkles,
  Play,
  Film,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { usePashuprenuerCourses, type PashuprenuerCourse } from "@/hooks/useFirebaseData";

export const Route = createFileRoute("/pashuprenuer")({
  head: () => ({ meta: [{ title: "Pashupreneur Courses — iHerd Admin" }] }),
  component: PashuprenuerPage,
});

function getYoutubePlaylistId(url: string): string | null {
  try {
    const match = url.match(/[?&]list=([^#&?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function getYoutubeVideoId(url: string): string | null {
  try {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  } catch {
    return null;
  }
}

function PashuprenuerPage() {
  const { courses, isLoading, refetch, saveCourse, deleteCourse, toggleCourseActive } = usePashuprenuerCourses();

  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<PashuprenuerCourse | null>(null);

  // Success Popup Modal
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Form Fields
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState("1");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setId("");
    setTitle("");
    setDescription("");
    const nextNum = (courses.length || 0) + 1;
    setOrder(String(nextNum));
    setYoutubeUrl("");
    setIsActive(true);
    setEditingCourse(null);
  };

  const openCreateDialog = () => {
    resetForm();
    const nextNum = (courses.length || 0) + 1;
    setId(`course_${nextNum}`);
    setOrder(String(nextNum));
    setDialogOpen(true);
  };

  const openEditDialog = (c: PashuprenuerCourse) => {
    setEditingCourse(c);
    setId(c.id);
    setTitle(c.title || `Dairy Entrepreneurship Module #${c.order || 1}`);
    setDescription(c.description || "");
    setOrder(String(c.order || 1));
    setYoutubeUrl(c.youtubeUrl || "");
    setIsActive(c.isActive !== false);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) {
      toast.error("Please enter a YouTube video or playlist URL.");
      return;
    }

    const payload: Partial<PashuprenuerCourse> = {
      id: id.trim() || `course_${Date.now()}`,
      title: title.trim() || `Pashupreneur Dairy Course #${order}`,
      description: description.trim(),
      order: Number(order) || 1,
      youtubeUrl: youtubeUrl.trim(),
      isActive,
    };

    try {
      await saveCourse.mutateAsync(payload);
      setDialogOpen(false);
      setSuccessMessage(
        editingCourse
          ? `Pashupreneur Course [${payload.id}] updated successfully!`
          : `New Pashupreneur Course [${payload.id}] created and published successfully!`
      );
      setSuccessModalOpen(true);
      toast.success(editingCourse ? "Updated successfully!" : "New course added successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save course");
    }
  };

  const handleToggle = async (c: PashuprenuerCourse) => {
    try {
      await toggleCourseActive.mutateAsync({ id: c.id, isActive: !c.isActive });
      toast.success(`Course ${!c.isActive ? "activated" : "deactivated"} successfully!`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to toggle status");
    }
  };

  const handleDelete = async (c: PashuprenuerCourse) => {
    if (!confirm(`Are you sure you want to delete course "${c.id}"?`)) return;
    try {
      await deleteCourse.mutateAsync(c.id);
      toast.success("Course deleted successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete course");
    }
  };

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const cid = (c.id || "").toLowerCase();
      const ctitle = (c.title || "").toLowerCase();
      const url = (c.youtubeUrl || "").toLowerCase();
      return !q || cid.includes(q) || ctitle.includes(q) || url.includes(q);
    });
  }, [courses, searchQuery]);

  const activeCount = courses.filter((c) => c.isActive).length;

  // Live video preview helpers for dialog
  const formPlaylistId = getYoutubePlaylistId(youtubeUrl);
  const formVideoId = getYoutubeVideoId(youtubeUrl);
  const hasValidVideo = Boolean(formPlaylistId || formVideoId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Pashupreneur Courses & Training"
        description="Manage dairy farming entrepreneurship curriculum and YouTube video playlists stored in /pashuprenuer_courses."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="gap-2 rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={openCreateDialog}
              className="gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm px-4"
            >
              <Plus className="h-4 w-4" /> Add New Pashupreneur Course
            </Button>
          </div>
        }
      />

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 rounded-2xl border bg-card/50 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 grid place-items-center shrink-0">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total Courses</div>
            <div className="text-xl font-bold text-foreground">{courses.length} Modules</div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border bg-card/50 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Active in Mobile App</div>
            <div className="text-xl font-bold text-foreground">{activeCount} Live</div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border bg-card/50 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 grid place-items-center shrink-0">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Curriculum Platform</div>
            <div className="text-sm font-bold text-foreground">YouTube Playlists</div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border bg-card/50 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center shrink-0">
            <PlaySquare className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Firestore Path</div>
            <div className="text-xs font-mono font-bold text-foreground truncate max-w-[170px]">
              pashuprenuer_courses
            </div>
          </div>
        </Card>
      </div>

      {/* Search Bar & Quick Add Button */}
      <Card className="p-4 rounded-2xl border bg-card shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search courses by ID (e.g. course_1), title or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl text-xs"
          />
        </div>

        <Button
          size="sm"
          onClick={openCreateDialog}
          className="rounded-xl bg-primary text-primary-foreground text-xs gap-1.5 font-semibold h-9 shrink-0 w-full sm:w-auto px-4 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" /> Add New Course Module
        </Button>
      </Card>

      {/* Courses Cards Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full h-40 grid place-items-center text-xs text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mb-2 text-primary" />
            Loading Pashupreneur curriculum from Firebase...
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full h-48 grid place-items-center text-xs text-muted-foreground border rounded-3xl bg-card p-6 text-center">
            <div>
              <GraduationCap className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
              <p className="font-semibold text-foreground mb-1">No courses found matching your search</p>
              <p className="text-muted-foreground mb-3">Click below to add a new course training module.</p>
              <Button
                size="sm"
                onClick={openCreateDialog}
                className="rounded-xl text-xs gap-1.5 font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add New Course Module
              </Button>
            </div>
          </div>
        ) : (
          filtered.map((c) => {
            return (
              <Card
                key={c.id}
                className="rounded-3xl border overflow-hidden bg-card shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Header */}
                  <div className="p-5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border-b flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-purple-600 text-white font-bold grid place-items-center shrink-0 shadow-sm text-sm">
                        #{c.order || 1}
                      </div>
                      <div>
                        <Badge variant="outline" className="font-mono text-[10px] mb-1">
                          {c.id}
                        </Badge>
                        <h4 className="font-bold text-sm text-foreground leading-tight">
                          {c.title || `Dairy Entrepreneurship Module #${c.order || 1}`}
                        </h4>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggle(c)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all shrink-0 ${
                        c.isActive
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Power className="h-3 w-3" />
                      {c.isActive ? "Live" : "Draft"}
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3">
                    {c.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {c.description}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Official video training module for dairy cattle management & farm economics.
                      </p>
                    )}

                    <div className="p-3 rounded-2xl border bg-muted/20 space-y-1.5">
                      <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Video className="h-3.5 w-3.5 text-red-500" />
                          YouTube Link:
                        </span>
                        <a
                          href={c.youtubeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
                        >
                          Watch <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="text-xs font-mono text-foreground break-all truncate">
                        {c.youtubeUrl || "No URL specified"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-muted/10 border-t flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <ListOrdered className="h-3.5 w-3.5" /> Order: {c.order || 1}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(c)}
                      className="rounded-xl h-8 px-2.5 text-xs gap-1.5 font-semibold hover:bg-muted"
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(c)}
                      className="rounded-xl h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                      title="Delete Course"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Add / Edit Dialog Modal with Clean UI/UX & Always-Visible Footer */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col rounded-3xl p-0 overflow-hidden shadow-2xl border bg-card">
          {/* STICKY TOP HEADER */}
          <div className="px-6 py-4 border-b bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent shrink-0">
            <DialogHeader className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-600 text-white shadow-sm shrink-0">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">
                    {editingCourse ? "Edit Pashupreneur Course" : "Add New Pashupreneur Course"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Configure video lesson details, display sequence order, and live YouTube preview.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* SCROLLABLE 2-COLUMN BODY */}
          <form id="courseForm" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: Input Form Fields (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* ID & Order */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="courseId" className="text-xs font-bold text-foreground">Document ID *</Label>
                    <Input
                      id="courseId"
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                      required
                      placeholder="e.g. course_3"
                      className="rounded-xl font-mono text-xs h-10"
                    />
                    <p className="text-[10px] text-muted-foreground">Unique doc key in Firestore</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="order" className="text-xs font-bold text-foreground">Display Order *</Label>
                    <Input
                      id="order"
                      type="number"
                      min="1"
                      value={order}
                      onChange={(e) => setOrder(e.target.value)}
                      required
                      className="rounded-xl font-mono text-xs font-bold h-10"
                    />
                    <p className="text-[10px] text-muted-foreground">Order position in mobile app list</p>
                  </div>
                </div>

                {/* Course Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs font-bold text-foreground">Course / Video Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. How to use Fine Kine to prevent Mastitis in cattle"
                    className="rounded-xl text-xs font-semibold h-10"
                  />
                </div>

                {/* YouTube Link */}
                <div className="space-y-1.5">
                  <Label htmlFor="ytUrl" className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>YouTube URL or Playlist Link *</span>
                    {hasValidVideo && (
                      <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <Check className="h-3 w-3" /> Video Detected
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Video className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
                    <Input
                      id="ytUrl"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      required
                      placeholder="https://youtu.be/... or https://www.youtube.com/watch?v=..."
                      className="pl-9 rounded-xl font-mono text-xs h-10"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Supports <code className="text-[10px] bg-muted px-1 py-0.5 rounded">youtu.be/...</code>, standard watch URLs, and playlist links.
                  </p>
                </div>

                {/* Course Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="desc" className="text-xs font-bold text-foreground">Course Description</Label>
                  <textarea
                    id="desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Summary of practical tips, dosage, instructions, or topics covered..."
                    className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Active Checkbox */}
                <div className="p-3.5 rounded-2xl border bg-muted/20 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-foreground">Live App Visibility</div>
                    <div className="text-[11px] text-muted-foreground">Publish immediately to the mobile app</div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className={isActive ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
                      {isActive ? "Active (Live)" : "Draft (Hidden)"}
                    </span>
                  </label>
                </div>
              </div>

              {/* RIGHT COLUMN: Live Video Embed & Preview Card (5 cols) */}
              <div className="lg:col-span-5 space-y-3">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5 text-red-500" />
                  Live Video Player Preview
                </Label>

                <div className="rounded-2xl border bg-muted/20 p-3 overflow-hidden shadow-xs space-y-2">
                  {hasValidVideo ? (
                    <div className="space-y-2">
                      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-sm">
                        <iframe
                          src={
                            formPlaylistId
                              ? `https://www.youtube.com/embed/videoseries?list=${formPlaylistId}`
                              : `https://www.youtube.com/embed/${formVideoId}`
                          }
                          title="YouTube video player preview"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="h-full w-full border-0"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Video Ready
                        </span>
                        <a
                          href={youtubeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          Open in YouTube <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video w-full rounded-xl border border-dashed grid place-items-center bg-card/60 p-4 text-center">
                      <div className="space-y-1.5">
                        <div className="h-10 w-10 rounded-full bg-red-500/10 text-red-500 grid place-items-center mx-auto">
                          <Film className="h-5 w-5" />
                        </div>
                        <div className="text-xs font-semibold text-foreground">No Video URL Added</div>
                        <p className="text-[11px] text-muted-foreground max-w-[190px]">
                          Paste any YouTube link on the left to see the live player preview here.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Summary info box */}
                  <div className="p-3 rounded-xl bg-background border text-[11px] space-y-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Target Document:</span>
                      <strong className="font-mono text-foreground">{id || "—"}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Curriculum Sequence:</span>
                      <strong className="text-foreground">#{order} in App</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Database Path:</span>
                      <strong className="font-mono text-foreground">/pashuprenuer_courses</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>

          {/* ALWAYS VISIBLE STICKY FOOTER */}
          <div className="px-6 py-3.5 border-t bg-muted/30 flex items-center justify-between shrink-0">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              All changes sync directly to Firebase Firestore
            </span>

            <div className="flex items-center gap-2.5 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="rounded-xl h-10 px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="courseForm"
                disabled={saveCourse.isPending}
                className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 px-6 text-xs shadow-sm"
              >
                {saveCourse.isPending ? "Saving..." : editingCourse ? "Update Course" : "Save & Publish Course"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Confirmation Modal Popup */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-2">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            Updated Successfully!
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {successMessage || "Pashupreneur course module has been saved and published successfully in Firebase at:"}
            <code className="block mt-2 font-mono text-[11px] bg-muted/60 p-2 rounded-xl text-foreground">
              /pashuprenuer_courses
            </code>
          </DialogDescription>
          <DialogFooter className="mt-4 sm:justify-center">
            <Button
              onClick={() => setSuccessModalOpen(false)}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6"
            >
              Done & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}