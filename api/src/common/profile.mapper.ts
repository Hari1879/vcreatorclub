/** Map a creator_profiles row to the camelCase shape the web app uses. */
export function mapProfile(r: any) {
  if (!r) return null;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    city: r.city,
    coordinationMode: r.coordination_mode,
    managerName: r.manager_name,
    managerContact: r.manager_contact,
    corePlatform: r.core_platform,
    instagramHandle: r.instagram_handle,
    instagramUrl: r.instagram_url,
    instagramFollowers: r.instagram_followers,
    youtubeHandle: r.youtube_handle,
    youtubeUrl: r.youtube_url,
    youtubeSubscribers: r.youtube_subscribers,
    facebookUrl: r.facebook_url,
    facebookFollowers: r.facebook_followers,
    linkedinUrl: r.linkedin_url,
    linkedinFollowers: r.linkedin_followers,
    threadsHandle: r.threads_handle,
    threadsUrl: r.threads_url,
    threadsFollowers: r.threads_followers,
    otherPlatforms: r.other_platforms,
    contentCategory: r.content_category,
    contentLanguages: r.content_languages ?? [],
    contentTypes: r.content_types ?? [],
    bio: r.bio,
    rateStory: num(r.rate_story_inr),
    ratePost: num(r.rate_post_inr),
    rateReel: num(r.rate_reel_inr),
    rateTvc: num(r.rate_tvc_inr),
    workedWithVivo: r.worked_with_vivo,
    vivoWorkDetails: r.vivo_work_details,
    profilePhotoUrl: r.profile_photo_url,
    status: r.status,
    tier: r.tier,
    enrolledAt: r.enrolled_at,
    approvedAt: r.approved_at,
    adminNotes: r.admin_notes,
    emailOptIn: r.email_opt_in ?? true,
  };
}

export function mapCampaign(r: any) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    product: r.product,
    campaignType: r.campaign_type,
    budgetInr: r.budget_inr === null ? null : Number(r.budget_inr),
    deliverables: r.deliverables ?? [],
    deadline: r.deadline,
    status: r.status,
    eligibleTiers: r.eligible_tiers ?? [],
    maxCreators: r.max_creators,
    createdAt: r.created_at,
    assignmentCount: r.assignment_count === undefined ? undefined : Number(r.assignment_count),
    myAssignmentStatus: r.my_assignment_status ?? undefined,
  };
}

export function mapNotification(r: any) {
  return {
    id: r.id,
    title: r.title,
    message: r.message,
    type: r.type,
    read: r.read,
    createdAt: r.created_at,
  };
}
