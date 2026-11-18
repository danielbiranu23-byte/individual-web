import type { Language } from './types';

export const DEFAULT_PROFILE = {
  ownerName: 'Daniel Biranu',
  roleTitleOm: 'College of Computing Department of Information system for 2026 Gc',
  roleTitleEn: 'College of Computing Department of Information system for 2026 Gc',
  headlineOm: 'Teeknoloojii ammayyaa, yaadannoo fi kuusaa hojii kootii bakka tokkotti.',
  headlineEn: 'Building modern software, sharing knowledge, and connecting ideas in one personal hub.',
  bioOm:
    'Baga gara websaayitii dhuunfaa kootii nagaan dhuftan! Ani ogeessa sooftiweerii fi barreessaa teeknoloojii yoon ta’u, asitti waa’ee koo, ogummaa koo, beeksisa haaraa, yaadannoowwan (notes) fi faayiloota barbaachisoo isiniif qooda. Akkasumas bakka waliin haasa’uufi gaaffii qabdan AI Chatbot yookiin ergaa kallattiin naaf erguu dandeessu.',
  bioEn:
    'Welcome to my personal digital home. I design and build full-stack web applications, document technical notes, share useful files, post updates, and host open community conversations. Feel free to explore my work, chat with the community, ask the AI assistant, or reach out directly.',
  location: 'Finfinnee, Oromia',
  email: 'danielbiranu142@gmail.com',
  phone: '+251932387559',
  githubUrl: 'https://github.com',
  linkedinUrl: 'https://linkedin.com',
  telegramUrl: 'https://t.me',
  avatarUrl: '/assets/aistudio/photo_2026-05-02_08-46-51_6667394b.jpg',
  yearsExperience: '5+ Waggaa',
  projectsCompleted: '28+ Pirojektii',
};

export const UI_TEXT: Record<
  Language,
  {
    nav: {
      about: string;
      skills: string;
      announcements: string;
      vault: string;
      community: string;
      contact: string;
      admin: string;
      signIn: string;
      signOut: string;
    };
    hero: {
      contactCta: string;
      vaultCta: string;
      chatCta: string;
      statYears: string;
      statProjects: string;
      statNotes: string;
      statFiles: string;
    };
    about: {
      sectionTitle: string;
      subtitle: string;
      locationLabel: string;
      emailLabel: string;
      linksLabel: string;
    };
    skills: {
      sectionTitle: string;
      subtitle: string;
      allCategories: string;
      empty: string;
      yearsSuffix: string;
    };
    announcements: {
      sectionTitle: string;
      subtitle: string;
      pinned: string;
      empty: string;
    };
    vault: {
      sectionTitle: string;
      subtitle: string;
      notesTab: string;
      filesTab: string;
      searchPlaceholder: string;
      allCategories: string;
      emptyNotes: string;
      emptyFiles: string;
      readMore: string;
      download: string;
      preview: string;
      readOnlyBadge: string;
      unsupportedInline: string;
      close: string;
      publicLabel: string;
      privateLabel: string;
    };
    community: {
      sectionTitle: string;
      subtitle: string;
      channels: {
        general: string;
        tech: string;
        qa: string;
      };
      signInPrompt: string;
      signInBtn: string;
      inputPlaceholder: string;
      send: string;
      empty: string;
      pin: string;
      unpin: string;
      deleteMsg: string;
      pinnedLabel: string;
    };
    contact: {
      sectionTitle: string;
      subtitle: string;
      sendTab: string;
      receiveTab: string;
      liveChatTab: string;
      nameLabel: string;
      emailLabel: string;
      subjectLabel: string;
      messageLabel: string;
      attachFileLabel: string;
      removeFile: string;
      sendBtn: string;
      sending: string;
      successMsg: string;
      errorMsg: string;
      blockedMsg: string;
      directTitle: string;
      trackingCodeLabel: string;
      copyCode: string;
      copiedCode: string;
      lookupDesc: string;
      lookupPlaceholder: string;
      lookupBtn: string;
      checking: string;
      recentCodesLabel: string;
      noReplyYet: string;
      invalidCode: string;
      adminReplyTitle: string;
      receivedFileTitle: string;
      receiveDownloadBtn: string;
      previewFileBtn: string;
      closePreview: string;
      liveTitle: string;
      liveDesc: string;
      liveEphemeralNote: string;
      liveOptionalEmail: string;
      liveStartBtn: string;
      liveEndClearBtn: string;
      liveEndedNotice: string;
      livePlaceholder: string;
      liveAttachMedia: string;
      liveEmpty: string;
      liveYouLabel: string;
      liveAdminLabel: string;
    };
    chatbot: {
      buttonLabel: string;
      title: string;
      subtitle: string;
      placeholder: string;
      send: string;
      clear: string;
      greeting: string;
      quickQuestions: string[];
      thinking: string;
    };
    admin: {
      title: string;
      backToSite: string;
      unauthorizedTitle: string;
      unauthorizedDesc: string;
      signInAdmin: string;
      tabs: {
        overview: string;
        profile: string;
        skills: string;
        announcements: string;
        notes: string;
        files: string;
        inbox: string;
        livechat: string;
        blocked: string;
        chat: string;
      };
      save: string;
      saving: string;
      saved: string;
      add: string;
      edit: string;
      cancel: string;
      delete: string;
      seedDemo: string;
      seeding: string;
      loginTitle: string;
      loginDesc: string;
      usernameLabel: string;
      usernamePlaceholder: string;
      passwordLabel: string;
      passwordPlaceholder: string;
      loginBtn: string;
      loggingIn: string;
      forgotPassword: string;
      resetTitle: string;
      resetVerifyDesc: string;
      verifyUsernameBtn: string;
      newPasswordLabel: string;
      confirmPasswordLabel: string;
      resetPasswordBtn: string;
      backToLogin: string;
      passwordMismatch: string;
      passwordMinLen: string;
      resetSuccess: string;
      googleSyncNeeded: string;
      connectGoogleSync: string;
      visitorAttachment: string;
      downloadAttachment: string;
      replyBtn: string;
      editReplyBtn: string;
      replyFormTitle: string;
      replyMessageLabel: string;
      replyFileLabel: string;
      sendReplyBtn: string;
      replySaved: string;
      replySentBadge: string;
      noTrackingCode: string;
      trackingCodePrefix: string;
      blockSenderBtn: string;
      blockedSuccess: string;
      unblockBtn: string;
      unblockedSuccess: string;
      blockedTitle: string;
      blockedDesc: string;
      blockEmailPlaceholder: string;
      blockReasonPlaceholder: string;
      addBlockBtn: string;
      noBlockedUsers: string;
      liveArchiveTitle: string;
      liveArchiveDesc: string;
      liveActiveBadge: string;
      liveEndedBadge: string;
      deleteThreadBtn: string;
      editMessageBtn: string;
      saveMessageBtn: string;
      editedBadge: string;
      adminNoteLabel: string;
      selectThreadPrompt: string;
      noLiveThreads: string;
    };
    footer: {
      rights: string;
      builtWith: string;
    };
  }
> = {
  om: {
    nav: {
      about: "Waa'ee Koo",
      skills: 'Ogummaa',
      announcements: 'Beeksisa',
      vault: 'Kuusaa',
      community: 'Haasaa',
      contact: 'Quunnamtii',
      admin: 'Bulchiinsa',
      signIn: 'Seeni',
      signOut: "Ba'i",
    },
    hero: {
      contactCta: 'Na Quunnami',
      vaultCta: 'Yaadannoo fi Faayiloota',
      chatCta: 'Bakka Haasaa',
      statYears: 'Muuxannoo',
      statProjects: 'Pirojektota',
      statNotes: 'Yaadannoo Ifaa',
      statFiles: 'Faayiloota',
    },
    about: {
      sectionTitle: "Waa'ee Koo",
      subtitle: 'Seenaa gabaabaa, kaayyoo fi bakka hojii kootii.',
      locationLabel: 'Bakka',
      emailLabel: 'Imeelii',
      linksLabel: 'Hidhaawwan',
    },
    skills: {
      sectionTitle: 'Ogummaa fi Dandeettii',
      subtitle: 'Teeknoloojii fi meeshaalee hojii koo keessatti fayyadamu.',
      allCategories: 'Hunda',
      empty: 'Ogummaan ammaaf hin galmoofne.',
      yearsSuffix: 'muuxannoo',
    },
    announcements: {
      sectionTitle: 'Beeksisa fi Oduu Haaraa',
      subtitle: 'Ergaa fi odeeffannoo haaraa yeroo yerootti qophaa’u.',
      pinned: 'Murteessaa',
      empty: 'Beeksisni maxxanfame ammaaf hin jiru.',
    },
    vault: {
      sectionTitle: 'Kuusaa Yaadannoo fi Faayilootaa',
      subtitle: 'Yaadannoo (Notes) barnootaa fi faayiloota olkaa’aman asitti dubbisi (buusuun hin danda’amu).',
      notesTab: 'Yaadannoo (Notes)',
      filesTab: 'Faayiloota (Files)',
      searchPlaceholder: 'Mata duree ykn jecha barbaadi...',
      allCategories: 'Hunda',
      emptyNotes: 'Yaadannoon ifaa ammaaf hin jiru.',
      emptyFiles: 'Faayiliin ifaa ammaaf hin jiru.',
      readMore: 'Guutuu Dubbisi',
      download: 'Buufadhu',
      preview: 'Dubbisi / Ilaali',
      readOnlyBadge: 'Dubbisuuf qofa',
      unsupportedInline: 'Faayiliin kun dubbisuuf qofa (buusuun cufameera). Akaakuun faayilii kanaa kallattiin browser keessatti hin banamu; PDF, suuraa ykn barreeffamaan olkaa’i.',
      close: 'Cufi',
      publicLabel: 'Ifaa (Public)',
      privateLabel: 'Dhuunfaa (Private)',
    },
    community: {
      sectionTitle: "Bakka Namoota Waliin Haasa'uu",
      subtitle: 'Yaada waliif qoodaa, gaaffii gaafadhaa, waliin mari’adhaa.',
      channels: {
        general: 'Waliigalaa',
        tech: 'Teeknoloojii',
        qa: 'Gaaffii fi Deebii',
      },
      signInPrompt: 'Ergaa barreessuuf akkawuntii Google keetiin seeni.',
      signInBtn: 'Google tiin Seeni',
      inputPlaceholder: 'Yaada kee asitti barreessi...',
      send: 'Ergi',
      empty: 'Ergaan ammaaf kutaa kana keessa hin jiru. Jalqaba ergi!',
      pin: 'Hidhi',
      unpin: 'Hiiki',
      deleteMsg: 'Haqi',
      pinnedLabel: 'Ergaa Hidhamte',
    },
    contact: {
      sectionTitle: 'Na Quunnami',
      subtitle: 'Ergaa, suuraa, viidiyoo fi faayilii naaf erguu, deebii fudhachuu ykn kallattiin Admin waliin haasa’uuf asitti fayyadami.',
      sendTab: 'Ergaa, Suuraa & Viidiyoo Ergi',
      receiveTab: 'Deebii & Faayilii Fudhadhu',
      liveChatTab: 'Haasaa Kallattii Admin',
      nameLabel: 'Maqaa Kee',
      emailLabel: 'Imeelii Kee',
      subjectLabel: 'Mata Duree',
      messageLabel: 'Ergaa',
      attachFileLabel: 'Suuraa, Viidiyoo ykn Faayilii Adminitti Ergi (Dirqama miti · Max 100MB)',
      removeFile: 'Haqi',
      sendBtn: 'Ergaa & Faayilii Ergi',
      sending: 'Ergamaa jira...',
      successMsg: 'Guddaa galatoomaa isin jedha Daniel! Ergaan keessanii fi faayiliin milkaa’inaan na gaheera.',
      errorMsg: 'Ergaa erguun hin danda’amne. Maaloo irra deebi’ii yaali.',
      blockedMsg: 'Ergaa ykn faayilii erguun cufameera — Admin si block godheera.',
      directTitle: 'Kallattiin Quunnamuuf',
      trackingCodeLabel: 'Koodii Hordoffii Kee (Deebii fi faayilii admin ittiin fudhadhu)',
      copyCode: 'Koppii Godhi',
      copiedCode: 'Koppii ta’eera',
      lookupDesc: 'Koodii hordoffii ergaa keetii galchuun deebii, suuraa, viidiyoo fi faayilii adminin siif erge asitti ilaali ykn fudhadhu.',
      lookupPlaceholder: 'Fkn: CON_...',
      lookupBtn: 'Deebii Ilaali',
      checking: 'Barbaadaa jira...',
      recentCodesLabel: 'Koodiiwwan ergaa keetii dhihoo',
      noReplyYet: 'Deebiin ykn faayiliin adminin ammaaf hin ergamne. Yeroo biraa irra deebi’ii ilaali.',
      invalidCode: 'Maaloo koodii sirrii (yoo xiqqaate qubee 12) galchi.',
      adminReplyTitle: 'Deebii Admin',
      receivedFileTitle: 'Faayilii / Miidiyaa Admin Siif Erge',
      receiveDownloadBtn: 'Fudhadhu (Download)',
      previewFileBtn: 'Dubbisi / Ilaali',
      closePreview: 'Cufi',
      liveTitle: 'Haasaa Kallattii Admin Waliin',
      liveDesc: 'Maqaa kee galchuun kallattiin Admin waliin haasa’i, suuraa fi viidiyoo ergi.',
      liveEphemeralNote: 'Hubachiisa: Hasaan kun gara keetti yeroo ammaa qofa mul’atee yeroo cufattu ni bada (garuu kutaa Admin keessatti ni olkaa’ama).',
      liveOptionalEmail: 'Imeelii (Dirqama miti)',
      liveStartBtn: 'Haasaa Jalqabi',
      liveEndClearBtn: 'Haasaa Cufi & Balleessi',
      liveEndedNotice: 'Hasaan kee gara keetti badeera. Haasaa haaraa yoo barbaadde jalqabuu dandeessa.',
      livePlaceholder: 'Ergaa kee asitti barreessi...',
      liveAttachMedia: 'Suuraa / Viidiyoo / Faayilii dabali',
      liveEmpty: 'Hasaan jalqabameera. Ergaa kee jalqabaa, suuraa ykn viidiyoo ergi!',
      liveYouLabel: 'Ati',
      liveAdminLabel: 'Admin (Daniel)',
    },
    chatbot: {
      buttonLabel: 'AI Gargaaraa',
      title: 'Gargaaraa AI',
      subtitle: "Waa'ee koo, ogummaa fi kuusaa faayilootaa na gaafadhu.",
      placeholder: 'Gaaffii kee Afaan Oromoo ykn Englishiin barreessi...',
      send: 'Ergi',
      clear: 'Haqi',
      greeting:
        "Akkam! Ani gargaaraa AI websaayitii kanaati. Waa'ee ogummaa, beeksisa, yaadannoo ykn akkamitti akka quunnamtu na gaafachuu dandeessa.",
      quickQuestions: [
        "Waa'ee abbaa websaayitii kanaa natti himi",
        'Ogummaa maal maal qaba?',
        'Beeksisa haaraan maaltu jira?',
      ],
      thinking: 'Yaadaa jira...',
    },
    admin: {
      title: 'Kutaa Bulchiinsaa (Admin)',
      backToSite: 'Gara Websaayitii Deebi’i',
      unauthorizedTitle: 'Hayyama Bulchiinsaa Barbaachisa',
      unauthorizedDesc:
        'Kutaa bulchiinsaa kana seenuuf imeelii admin mirkanaa’een (danielbiranu142@gmail.com) Google tiin seenuu qabda.',
      signInAdmin: 'Admin Google tiin Seeni',
      tabs: {
        overview: 'Gabaasa Waliigalaa',
        profile: "Waa'ee & Profaayilii",
        skills: 'Ogummaa',
        announcements: 'Beeksisa',
        notes: 'Yaadannoo (Notes)',
        files: 'Suuraa, Viidiyoo & Faayilii',
        inbox: 'Ergaawwan Quunnamtii',
        livechat: 'Kuusaa Haasaa Admin',
        blocked: 'Namoota Block Ta’an',
        chat: 'To’annoo Haasaa',
      },
      save: 'Olkaa’i',
      saving: 'Olkaa’amaa jira...',
      saved: 'Olkaa’ameera',
      add: 'Haaraa Dabali',
      edit: 'Gulaali',
      cancel: 'Dhiisi',
      delete: 'Haqi',
      seedDemo: 'Daataa Fakkeenyaa Galchi',
      seeding: 'Galchamaa jira...',
      loginTitle: 'Seensa Bulchiinsaa (Admin)',
      loginDesc: 'Kutaa bulchiinsaa banuuf maqaa fayyadamaa fi jecha iccitii kee galchi.',
      usernameLabel: 'Maqaa Fayyadamaa (Username)',
      usernamePlaceholder: 'Maqaa fayyadamaa galchi',
      passwordLabel: 'Jecha Iccitii (Password)',
      passwordPlaceholder: '••••••••',
      loginBtn: 'Seeni',
      loggingIn: 'Mirkaneessaa jira...',
      forgotPassword: 'Password dagattee?',
      resetTitle: 'Password Haaromsi (Reset)',
      resetVerifyDesc: 'Password haaromsuuf dura maqaa fayyadamaa (username) kee duraanii galchi.',
      verifyUsernameBtn: 'Username Mirkaneessi',
      newPasswordLabel: 'Password Haaraa',
      confirmPasswordLabel: 'Password Irra Deebi’i',
      resetPasswordBtn: 'Password Jijjiiri',
      backToLogin: 'Gara Seensaatti Deebi’i',
      passwordMismatch: 'Password lachuu wal hin fakkaatu.',
      passwordMinLen: 'Password yoo xiqqaate qubee 6 qabaachuu qaba.',
      resetSuccess: 'Password milkaa’inaan haaroomeera! Amma seenuu dandeessa.',
      googleSyncNeeded: 'Daataa Firestore keessatti olkaa’uuf akkawuntii Google (danielbiranu142@gmail.com) walqunnamsiisi.',
      connectGoogleSync: 'Google Sync Walqunnamsiisi',
      visitorAttachment: 'Faayilii / Miidiyaa Namni Erge',
      downloadAttachment: 'Fudhadhu (Download)',
      replyBtn: 'Deebii & Faayilii Ergi',
      editReplyBtn: 'Deebii Gulaali',
      replyFormTitle: 'Deebii, Suuraa ykn Viidiyoo Deebisi',
      replyMessageLabel: 'Ergaa Deebii',
      replyFileLabel: 'Suuraa, Viidiyoo ykn Faayilii Deebii Dabali (Max 100MB)',
      sendReplyBtn: 'Deebii & Faayilii Ergi',
      replySaved: 'Deebiin fi faayiliin milkaa’inaan ergameera!',
      replySentBadge: 'Deebiin Ergameera',
      noTrackingCode: 'Ergaan kun koodii hordoffii durii hin qabu.',
      trackingCodePrefix: 'Koodii',
      blockSenderBtn: 'Block Godhi',
      blockedSuccess: 'Fayyadamaan milkaa’inaan block ta’eera!',
      unblockBtn: 'Block Irraa Hiiki',
      unblockedSuccess: 'Block irraa hiikameera.',
      blockedTitle: 'Namoota Admin Jeeqan Block Gochuu',
      blockedDesc: 'Namoonni ergaa hin taane erganii si jeeqan akka ergaa, suuraa, viidiyoo fi haasaa hin ergine asitti to’adhu.',
      blockEmailPlaceholder: 'Imeelii block gochuu barbaaddu galchi...',
      blockReasonPlaceholder: 'Sababa block gootuuf (dirqama miti)...',
      addBlockBtn: 'Imeelii Block Godhi',
      noBlockedUsers: 'Ammaaf namni block ta’e hin jiru.',
      liveArchiveTitle: 'Kuusaa Haasaa Namoota & Admin (Archive)',
      liveArchiveDesc: 'Hasaan namoonni kallattiin si waliin godhan hundi bakka kanatti olkaa’ama; gulaaluu (edit), haquu (delete) ykn deebii kennuu dandeessa.',
      liveActiveBadge: 'Haasaa Irra Jira',
      liveEndedBadge: 'Xumurameera',
      deleteThreadBtn: 'Haasaa Guutuu Haqi',
      editMessageBtn: 'Gulaali',
      saveMessageBtn: 'Olkaa’i',
      editedBadge: 'Gulaalameera',
      adminNoteLabel: 'Yaadannoo Admin (Thread Note)',
      selectThreadPrompt: 'Ilaaluuf, gulaaluuf ykn deebisuuf bitaa irraa haasaa tokko filadhu.',
      noLiveThreads: 'Hasaan kallattii ammaaf hin jiru.',
    },
    footer: {
      rights: 'Mirgi hundi eegamaa dha.',
      builtWith: 'Websaayitii dhuunfaa fi kuusaa yaadannoo.',
    },
  },
  en: {
    nav: {
      about: 'About',
      skills: 'Skills',
      announcements: 'Updates',
      vault: 'Vault',
      community: 'Chat',
      contact: 'Contact',
      admin: 'Admin',
      signIn: 'Sign In',
      signOut: 'Sign Out',
    },
    hero: {
      contactCta: 'Get in Touch',
      vaultCta: 'Notes & Files',
      chatCta: 'Community Chat',
      statYears: 'Experience',
      statProjects: 'Projects',
      statNotes: 'Public Notes',
      statFiles: 'Saved Files',
    },
    about: {
      sectionTitle: 'About Me',
      subtitle: 'Background, mission, and how to connect.',
      locationLabel: 'Location',
      emailLabel: 'Email',
      linksLabel: 'Links',
    },
    skills: {
      sectionTitle: 'Skills & Craft',
      subtitle: 'Core technologies, engineering disciplines, and tools I work with.',
      allCategories: 'All',
      empty: 'No skills added yet.',
      yearsSuffix: 'experience',
    },
    announcements: {
      sectionTitle: 'Announcements',
      subtitle: 'Latest news, releases, and personal updates.',
      pinned: 'Pinned',
      empty: 'No published announcements yet.',
    },
    vault: {
      sectionTitle: 'Notes & File Vault',
      subtitle: 'Read saved study notes and view-only documents directly on this page (downloading disabled).',
      notesTab: 'Notes',
      filesTab: 'Files',
      searchPlaceholder: 'Search notes or files...',
      allCategories: 'All',
      emptyNotes: 'No public notes available yet.',
      emptyFiles: 'No public files available yet.',
      readMore: 'Read Full Note',
      download: 'Download',
      preview: 'Read / View',
      readOnlyBadge: 'Read-only',
      unsupportedInline: 'This file is read-only (downloading is disabled). This file format cannot be rendered directly in the browser; upload PDF, image, or text/markdown files for inline reading.',
      close: 'Close',
      publicLabel: 'Public',
      privateLabel: 'Private',
    },
    community: {
      sectionTitle: 'Community Chat',
      subtitle: 'Join real-time discussions, share ideas, and ask questions.',
      channels: {
        general: 'General',
        tech: 'Tech & Builds',
        qa: 'Q & A',
      },
      signInPrompt: 'Sign in with Google to send messages in the community chat.',
      signInBtn: 'Sign in with Google',
      inputPlaceholder: 'Write a message...',
      send: 'Send',
      empty: 'No messages in this channel yet. Start the conversation!',
      pin: 'Pin',
      unpin: 'Unpin',
      deleteMsg: 'Delete',
      pinnedLabel: 'Pinned Message',
    },
    contact: {
      sectionTitle: 'Contact Me',
      subtitle: 'Send messages, photos, videos, or files to the admin, receive replies, or start a live session chat.',
      sendTab: 'Send Message, Photo & Video',
      receiveTab: 'Receive Reply & File',
      liveChatTab: 'Live Chat with Admin',
      nameLabel: 'Your Name',
      emailLabel: 'Your Email',
      subjectLabel: 'Subject',
      messageLabel: 'Message',
      attachFileLabel: 'Attach Photo, Video, or File for Admin (Optional · Max 100MB)',
      removeFile: 'Remove',
      sendBtn: 'Send Message & File',
      sending: 'Sending...',
      successMsg: 'Thank you very much, says Daniel! Your message and file have been received.',
      errorMsg: 'Could not send message. Please try again.',
      blockedMsg: 'Sending is blocked — this sender/device has been blocked by the administrator.',
      directTitle: 'Direct Channels',
      trackingCodeLabel: 'Your Tracking Code (Save this to receive Admin replies & files)',
      copyCode: 'Copy Code',
      copiedCode: 'Copied',
      lookupDesc: 'Enter your tracking code below to view replies and preview or download photos, videos, and files sent by the admin.',
      lookupPlaceholder: 'e.g. CON_...',
      lookupBtn: 'Check Reply',
      checking: 'Checking...',
      recentCodesLabel: 'Your recent tracking codes',
      noReplyYet: 'No reply or file from the admin yet for this tracking code. Please check back later.',
      invalidCode: 'Please enter a valid tracking code (at least 12 characters).',
      adminReplyTitle: 'Admin Reply',
      receivedFileTitle: 'Media / File Sent by Admin',
      receiveDownloadBtn: 'Receive / Download',
      previewFileBtn: 'Preview',
      closePreview: 'Close',
      liveTitle: 'Live Chat with Admin',
      liveDesc: 'Enter your name to chat directly with the admin and exchange photos, videos, or messages in real time.',
      liveEphemeralNote: 'Privacy note: Messages appear on your screen only during this live session and disappear once you close or leave (archived securely in the Admin console).',
      liveOptionalEmail: 'Email (Optional)',
      liveStartBtn: 'Start Live Chat',
      liveEndClearBtn: 'End & Clear Chat',
      liveEndedNotice: 'Your chat view has been cleared from this screen. Start a new session whenever needed.',
      livePlaceholder: 'Type a live message...',
      liveAttachMedia: 'Attach Photo / Video / File',
      liveEmpty: 'Live session connected. Send your first message, photo, or video!',
      liveYouLabel: 'You',
      liveAdminLabel: 'Admin (Daniel)',
    },
    chatbot: {
      buttonLabel: 'AI Assistant',
      title: 'Personal AI Assistant',
      subtitle: 'Ask about my skills, updates, notes, or contact details.',
      placeholder: 'Ask a question in English or Afaan Oromo...',
      send: 'Send',
      clear: 'Clear',
      greeting:
        'Hello! I am the AI assistant for this personal website. Ask me anything about skills, announcements, saved resources, or how to get in touch.',
      quickQuestions: [
        'Tell me about the website owner',
        'What skills are featured here?',
        'Are there any recent announcements?',
      ],
      thinking: 'Thinking...',
    },
    admin: {
      title: 'Admin Console',
      backToSite: 'Back to Website',
      unauthorizedTitle: 'Admin Authorization Required',
      unauthorizedDesc:
        'Please sign in with the verified admin Google account (danielbiranu142@gmail.com) to manage website content, private notes, files, and messages.',
      signInAdmin: 'Sign in as Admin',
      tabs: {
        overview: 'Overview',
        profile: 'About & Profile',
        skills: 'Skills',
        announcements: 'Announcements',
        notes: 'Notes Vault',
        files: 'Photos, Videos & Files',
        inbox: 'Contact Inbox',
        livechat: 'Admin Chat Archive',
        blocked: 'Blocked Users',
        chat: 'Chat Moderation',
      },
      save: 'Save Changes',
      saving: 'Saving...',
      saved: 'Saved',
      add: 'Add New',
      edit: 'Edit',
      cancel: 'Cancel',
      delete: 'Delete',
      seedDemo: 'Load Sample Content',
      seeding: 'Loading...',
      loginTitle: 'Admin Sign In',
      loginDesc: 'Enter your administrator username and password to access the console.',
      usernameLabel: 'Username',
      usernamePlaceholder: 'Enter username',
      passwordLabel: 'Password',
      passwordPlaceholder: '••••••••',
      loginBtn: 'Sign In',
      loggingIn: 'Signing in...',
      forgotPassword: 'Forgot password?',
      resetTitle: 'Reset Admin Password',
      resetVerifyDesc: 'Enter your registered username first to verify your account before resetting the password.',
      verifyUsernameBtn: 'Verify Username',
      newPasswordLabel: 'New Password',
      confirmPasswordLabel: 'Confirm New Password',
      resetPasswordBtn: 'Update Password',
      backToLogin: 'Back to Sign In',
      passwordMismatch: 'Passwords do not match.',
      passwordMinLen: 'Password must be at least 6 characters.',
      resetSuccess: 'Password updated successfully. You can now sign in.',
      googleSyncNeeded: 'Connect your authorized Google account (danielbiranu142@gmail.com) to sync changes with Firestore.',
      connectGoogleSync: 'Connect Google Sync',
      visitorAttachment: 'Visitor Attachment',
      downloadAttachment: 'Download File',
      replyBtn: 'Reply & Send File',
      editReplyBtn: 'Edit Reply',
      replyFormTitle: 'Send Reply, Photo, Video, or File',
      replyMessageLabel: 'Reply Message',
      replyFileLabel: 'Attach Return Photo, Video, or File (Max 100MB)',
      sendReplyBtn: 'Send Reply & File',
      replySaved: 'Reply and file sent successfully!',
      replySentBadge: 'Replied',
      noTrackingCode: 'Legacy message without tracking code.',
      trackingCodePrefix: 'Code',
      blockSenderBtn: 'Block User',
      blockedSuccess: 'User blocked from sending messages/media!',
      unblockBtn: 'Unblock',
      unblockedSuccess: 'User unblocked.',
      blockedTitle: 'Blocked Users & Anti-Harassment',
      blockedDesc: 'Block disruptive visitors or accounts so they cannot send messages, media, or live chat requests.',
      blockEmailPlaceholder: 'Enter email to block...',
      blockReasonPlaceholder: 'Reason for blocking (optional)...',
      addBlockBtn: 'Block Email',
      noBlockedUsers: 'No blocked users yet.',
      liveArchiveTitle: 'Saved Visitor–Admin Chat Archive',
      liveArchiveDesc: 'All direct chats with visitors are permanently saved here even after disappearing from the visitor screen. You can reply, edit messages, or delete them anytime.',
      liveActiveBadge: 'Live Now',
      liveEndedBadge: 'Ended',
      deleteThreadBtn: 'Delete Conversation',
      editMessageBtn: 'Edit',
      saveMessageBtn: 'Save',
      editedBadge: 'Edited',
      adminNoteLabel: 'Admin Note',
      selectThreadPrompt: 'Select a saved conversation on the left to read, reply, edit, or delete messages.',
      noLiveThreads: 'No saved live chats yet.',
    },
    footer: {
      rights: 'All rights reserved.',
      builtWith: 'Personal hub, knowledge vault & community space.',
    },
  },
};
