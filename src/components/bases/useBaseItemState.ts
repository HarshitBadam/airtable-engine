"use client";

import { useState, useRef, useEffect } from "react";
import { MENU_WIDTH, MENU_HEIGHT, VIEWPORT_EDGE_BUFFER, HOVER_RESET_DELAY } from "~/shared/constants";

interface UseBaseItemStateArgs {
  baseName: string;
  onRename: (newName: string) => void;
}

export interface UseBaseItemStateResult {
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  menuRight: boolean;
  menuUp: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isRenaming: boolean;
  editName: string;
  setEditName: React.Dispatch<React.SetStateAction<string>>;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  isClicked: boolean;
  setIsClickedFn: (val: boolean) => void;
  checkMenuPosition: () => void;
  handleRenameClick: () => void;
  handleRenameSubmit: () => void;
  handleRenameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleDeleteClick: () => void;
  handleDeleteConfirm: (onDelete: () => void) => void;
  handleDeleteCancel: () => void;
}

export function useBaseItemState({
  baseName,
  onRename,
}: UseBaseItemStateArgs): UseBaseItemStateResult {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRight, setMenuRight] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(baseName);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const setIsClickedFn = (val: boolean) => {
    setIsClicked(val);
    if (val) setTimeout(() => setIsClicked(false), 300);
  };

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const checkMenuPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuRight(rect.left + MENU_WIDTH > window.innerWidth - VIEWPORT_EDGE_BUFFER);
      setMenuUp(rect.bottom + MENU_HEIGHT > window.innerHeight - VIEWPORT_EDGE_BUFFER);
    }
  };

  const handleRenameClick = () => {
    setMenuOpen(false);
    setEditName(baseName);
    setIsRenaming(true);
  };

  const handleRenameSubmit = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== baseName) {
      onRename(trimmed);
    }
    setIsRenaming(false);
    // Brief delay to let hover styles settle after rename mode exits
    setTimeout(() => { /* allow hover styles to settle */ }, HOVER_RESET_DELAY);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
      setEditName(baseName);
    }
  };

  const handleDeleteClick = () => {
    setMenuOpen(false);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = (onDelete: () => void) => {
    setShowDeleteConfirm(false);
    onDelete();
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  return {
    menuOpen,
    setMenuOpen,
    menuRight,
    menuUp,
    menuRef,
    buttonRef,
    inputRef,
    isRenaming,
    editName,
    setEditName,
    showDeleteConfirm,
    setShowDeleteConfirm,
    isClicked,
    setIsClickedFn,
    checkMenuPosition,
    handleRenameClick,
    handleRenameSubmit,
    handleRenameKeyDown,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  };
}
