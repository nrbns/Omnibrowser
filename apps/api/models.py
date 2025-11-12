"""
Database Models - SQLAlchemy
"""

from sqlalchemy import Column, String, Integer, Float, Boolean, JSON, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False, index=True)
    handle = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    plan = Column(String, default="free")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    workspaces = relationship("Workspace", back_populates="user")

class Workspace(Base):
    __tablename__ = "workspaces"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    mode = Column(String, nullable=False)  # research, trade, game, etc.
    vpn_profile_id = Column(String, nullable=True)
    settings_json = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="workspaces")
    tabs = relationship("Tab", back_populates="workspace", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="workspace", cascade="all, delete-orphan")
    runs = relationship("Run", back_populates="workspace", cascade="all, delete-orphan")

class Tab(Base):
    __tablename__ = "tabs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    url = Column(String, nullable=False)
    title = Column(String, nullable=True)
    status = Column(String, default="active")  # active, sleeping, closed
    created_at = Column(DateTime, default=datetime.utcnow)
    
    workspace = relationship("Workspace", back_populates="tabs")

class Note(Base):
    __tablename__ = "notes"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    content_md = Column(Text, nullable=False)
    sources_json = Column(JSON, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    workspace = relationship("Workspace", back_populates="notes")

class Run(Base):
    __tablename__ = "runs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    task = Column(Text, nullable=False)
    status = Column(String, default="pending")  # pending, running, completed, failed
    tokens = Column(Integer, default=0)
    cost = Column(Float, default=0.0)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    
    workspace = relationship("Workspace", back_populates="runs")
    artifacts = relationship("Artifact", back_populates="run", cascade="all, delete-orphan")

class Artifact(Base):
    __tablename__ = "artifacts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(String, ForeignKey("runs.id"), nullable=False, index=True)
    type = Column(String, nullable=False)  # csv, json, pdf, etc.
    path = Column(String, nullable=False)
    meta_json = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    
    run = relationship("Run", back_populates="artifacts")

class SearchIndex(Base):
    __tablename__ = "search_index"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    url = Column(String, nullable=False, index=True)
    title = Column(String, nullable=True)
    lang = Column(String, default="en")
    chunk_id = Column(String, nullable=True)
    vec = Column(JSON, nullable=True)  # Vector embedding (as JSON array)
    ts = Column(DateTime, default=datetime.utcnow, index=True)

class Download(Base):
    __tablename__ = "downloads"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String, nullable=True, index=True)
    url = Column(String, nullable=False)
    file_path = Column(String, nullable=True)
    hash = Column(String, nullable=True)  # SHA-256 checksum
    verdict = Column(String, nullable=True)  # safe, suspicious, malicious
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

