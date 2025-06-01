import type { Site, Metadata, Socials } from "@types";

export const SITE: Site = {
    NAME: "kumarpit.github.io",
    EMAIL: "kumarpit@proton.me",
    NUM_POSTS_ON_HOMEPAGE: 3,
    NUM_WORKS_ON_HOMEPAGE: 5,
    NUM_PROJECTS_ON_HOMEPAGE: 3,
};

export const HOME: Metadata = {
    TITLE: "Home",
    DESCRIPTION: "Astro Nano is a minimal and lightweight blog and portfolio.",
};

export const BLOG: Metadata = {
    TITLE: "Blog",
    DESCRIPTION: "A collection of articles on topics I am passionate about.",
};

export const ABOUT: Metadata = {
    TITLE: "About",
    DESCRIPTION: "A little bit about me.",
};

export const WORK: Metadata = {
    TITLE: "Work",
    DESCRIPTION: "Where I have worked and what I have done.",
};

export const PROJECTS: Metadata = {
    TITLE: "Projects",
    DESCRIPTION: "A collection of my projects, with links to repositories and demos.",
};

export const SOCIALS: Socials = [
    {
        NAME: "twitter",
        HREF: "https://twitter.com/kumaaarpit",
        ICON: "mdi:twitter"
    },
    {
        NAME: "github",
        HREF: "https://github.com/kumarpit",
        ICON: "mdi:github"
    },
    {
        NAME: "linkedin",
        HREF: "https://www.linkedin.com/in/krarpit",
        ICON: "mdi:linkedin"
    }
];
